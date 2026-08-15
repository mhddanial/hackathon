import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from agent_config import SYSTEM_PROMPT, TOOL_SCHEMAS

router = APIRouter()

# Configure Gemini API
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    print("WARNING: GEMINI_API_KEY not found in environment variables!")

# Initialize the model
model = genai.GenerativeModel(
    model_name='gemini-3.5-flash-lite',
    system_instruction=SYSTEM_PROMPT,
    tools=TOOL_SCHEMAS
)

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
    """Router to execute the correct tool based on Gemini's request"""
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

# ---------------------------------------------------------
# Agent Chat Endpoint
# ---------------------------------------------------------
@router.post("/chat")
def chat_with_agent(request: ChatRequest):
    if not api_key:
        return {"reply": "Sistem AI belum dikonfigurasi (API Key hilang). Silakan gunakan pencarian manual."}

    async def generate_response():
        try:
            # Start a chat session
            chat = model.start_chat()
            
            # Send user message
            response = chat.send_message(request.message)
            
            # Check if Gemini decided to call a function
            func_call = None
            if response.parts:
                for part in response.parts:
                    if part.function_call:
                        func_call = part.function_call
                        break

            if func_call:
                func_name = func_call.name
                func_args = {k: v for k, v in func_call.args.items()}
                
                # Yield intermediate status based on the tool
                status_msg = "Processing request..."
                if func_name == "get_congestion_level":
                    status_msg = f"⚙️ Checking live congestion for {func_args.get('segment_id')}..."
                elif func_name == "get_optimal_route":
                    status_msg = "⚙️ Calculating optimal route and emissions..."
                elif func_name == "get_ferry_schedule":
                    status_msg = f"⚙️ Fetching live ferry schedules for {func_args.get('terminal')}..."
                    
                yield f"data: {json.dumps({'type': 'status', 'content': status_msg})}\n\n"
                
                # Execute the internal Python function
                tool_result = execute_tool(func_name, func_args)
                
                yield f"data: {json.dumps({'type': 'status', 'content': '✅ Data retrieved. Generating final response...'})}\n\n"
                
                # Send the tool result back to Gemini and get STREAMING response
                final_response = chat.send_message(
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=func_name,
                            response={"result": tool_result}
                        )
                    ),
                    stream=True
                )
                
                for chunk in final_response:
                    try:
                        if chunk.text:
                            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.text})}\n\n"
                    except ValueError:
                        # Ignore chunks that don't have text (e.g. function calls)
                        pass
                
            else:
                # If no function was called, we could just return the text.
                # However, since we didn't use stream=True on the first call, 
                # we'll just yield it as a single chunk.
                yield f"data: {json.dumps({'type': 'chunk', 'content': response.text})}\n\n"
                
        except Exception as e:
            print(f"Gemini API Error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'Maaf, sistem asisten AI sedang sibuk atau mengalami gangguan jaringan.'})}\n\n"
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate_response(), media_type="text/event-stream")
