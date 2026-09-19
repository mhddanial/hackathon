import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from agent_config import SYSTEM_PROMPT, TOOL_SCHEMAS

router = APIRouter()

# Lightning AI exposes an OpenAI-compatible Chat Completions API.
LIGHTNING_API_BASE_URL = "https://lightning.ai/api/v1/"
LIGHTNING_MODEL = "google/gemini-3.5-flash"
api_key = os.environ.get("LIGHTNING_API_KEY")
client = OpenAI(base_url=LIGHTNING_API_BASE_URL, api_key=api_key) if api_key else None

class ChatRequest(BaseModel):
    message: str

# ---------------------------------------------------------
# Real Tool Functions 
# ---------------------------------------------------------
from routers.congestion import get_congestion
from database import get_supabase_client
from routers.route import calculate_route, RouteRequest, Point
from datetime import datetime

def execute_tool(function_name: str, args: dict):
    """Execute a function requested by the AI model."""
    if function_name == "get_congestion_level":
        try:
            # Reusing the logic from our actual endpoint
            result = get_congestion(
                segment_id=args.get("segment_id"),
                day_type=args.get("day_type", "weekday").lower(),
                hour=int(args.get("hour"))
            )
            return result
        except Exception as e:
            return {"error": f"Failed to get congestion level: {str(e)}"}
            
    elif function_name == "get_optimal_route":
        try:
            origin_str = args.get("origin", "")
            dest_str = args.get("destination", "")
            
            # Parse "lat, lng"
            origin_lat, origin_lng = map(float, [x.strip() for x in origin_str.split(',')])
            dest_lat, dest_lng = map(float, [x.strip() for x in dest_str.split(',')])
            
            now = datetime.now()
            time_str = args.get("time", f"{now.hour:02d}:{now.minute:02d}")
            
            req = RouteRequest(
                origin=Point(lat=origin_lat, lng=origin_lng),
                destination=Point(lat=dest_lat, lng=dest_lng),
                time=time_str,
                day_type="weekday"
            )
            
            # Get real routing data
            result = calculate_route(req)
            
            # CRITICAL: strip out route_geometry GeoJSON so we don't blow up Gemini's context window!
            if "route_geometry" in result:
                del result["route_geometry"]
                
            # Add metadata so the AI knows what time was used and can suggest off-peak times
            result["_meta"] = {
                "time_calculated_for": time_str,
                "ai_instruction": "Mention the time used. If the estimated duration seems high, suggest leaving early morning (e.g., 06:00) to avoid peak multiplier, lower duration, and reduce CO2 emissions."
            }
                
            return result
        except ValueError:
            return {"error": "Could not parse coordinates. Please provide origin and destination exactly as 'latitude, longitude'."}
        except Exception as e:
            return {"error": f"Failed to get optimal route: {str(e)}"}
        
    elif function_name == "get_ferry_schedule":
        try:
            supabase = get_supabase_client()
            terminal_name = args.get("terminal")
            # Query the database
            response = supabase.table("ferry_schedules").select("*").ilike("terminal_name", f"%{terminal_name}%").execute()
            if not response.data:
                return {"error": f"No ferry schedules found for terminal '{terminal_name}'"}
            
            schedules = response.data
            formatted_results = []
            for s in schedules:
                formatted_results.append({
                    "terminal": s['terminal_name'],
                    "destination": s['destination'],
                    "departure_time": s['departure_time'],
                    "cutoff_time": s.get('cutoff_time'),
                    "vessel_type": s.get('vessel_type'),
                    "cargo_capacity": s.get('cargo_capacity_tons')
                })
            return {"schedules": formatted_results}
        except Exception as e:
             return {"error": f"Failed to fetch ferry schedules: {str(e)}"}
             
    else:
        return {"error": f"Unknown function: {function_name}"}


def sse_event(event_type: str, content: str | None = None) -> str:
    payload = {"type": event_type}
    if content is not None:
        payload["content"] = content
    return f"data: {json.dumps(payload)}\n\n"


def tool_status_message(function_name: str, args: dict) -> str:
    if function_name == "get_congestion_level":
        return f"⚙️ Checking live congestion for {args.get('segment_id')}..."
    if function_name == "get_optimal_route":
        return "⚙️ Calculating optimal route and emissions..."
    if function_name == "get_ferry_schedule":
        return f"⚙️ Fetching live ferry schedules for {args.get('terminal')}..."
    return "Processing request..."

# ---------------------------------------------------------
# Agent Chat Endpoint
# ---------------------------------------------------------
@router.post("/chat")
def chat_with_agent(request: ChatRequest):
    if not client:
        return {"reply": "Sistem AI belum dikonfigurasi (API Key hilang). Silakan gunakan pencarian manual."}

    def generate_response():
        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request.message},
            ]
            tool_rounds = 0

            while True:
                stream = client.chat.completions.create(
                    model=LIGHTNING_MODEL,
                    messages=messages,
                    tools=TOOL_SCHEMAS,
                    tool_choice="auto",
                    stream=True,
                )

                text_parts = []
                streamed_tool_calls = {}
                for chunk in stream:
                    if not chunk.choices:
                        continue

                    delta = chunk.choices[0].delta
                    if delta.content:
                        text_parts.append(delta.content)
                        yield sse_event("chunk", delta.content)

                    for tool_delta in delta.tool_calls or []:
                        tool_call = streamed_tool_calls.setdefault(
                            tool_delta.index,
                            {"id": None, "name": "", "arguments": ""},
                        )
                        if tool_delta.id:
                            tool_call["id"] = tool_delta.id
                        if tool_delta.function:
                            if tool_delta.function.name:
                                tool_call["name"] += tool_delta.function.name
                            if tool_delta.function.arguments:
                                tool_call["arguments"] += tool_delta.function.arguments

                if not streamed_tool_calls:
                    break

                if tool_rounds >= 3:
                    yield sse_event("error", "The AI exceeded the tool-call limit.")
                    return

                tool_rounds += 1
                completed_tool_calls = []
                for tool_call in (streamed_tool_calls[index] for index in sorted(streamed_tool_calls)):
                    if not tool_call["id"] or not tool_call["name"]:
                        yield sse_event("error", "The AI returned an incomplete tool call.")
                        return

                    try:
                        func_args = json.loads(tool_call["arguments"] or "{}")
                    except json.JSONDecodeError:
                        if not isinstance(func_args, dict):
                            raise ValueError("Tool arguments must be an object.")
                    except (json.JSONDecodeError, ValueError):
                        yield sse_event("error", "The AI returned invalid tool arguments.")
                        return

                    yield sse_event("status", tool_status_message(tool_call["name"], func_args))
                    tool_result = execute_tool(tool_call["name"], func_args)
                    completed_tool_calls.append({
                        "id": tool_call["id"],
                        "type": "function",
                        "function": {
                            "name": tool_call["name"],
                            "arguments": tool_call["arguments"],
                        },
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(tool_result),
                    })

                messages.insert(
                    len(messages) - len(completed_tool_calls),
                    {
                        "role": "assistant",
                        "content": "".join(text_parts) or None,
                        "tool_calls": completed_tool_calls,
                    },
                )
                yield sse_event("status", "✅ Data retrieved. Generating final response...")

        except Exception as e:
            print(f"Lightning AI API Error: {e}")
            yield sse_event("error", "Maaf, sistem asisten AI sedang sibuk atau mengalami gangguan jaringan.")
        
        yield sse_event("done")

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
