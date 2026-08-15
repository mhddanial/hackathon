import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agent_config import SYSTEM_PROMPT, TOOL_SCHEMAS

router = APIRouter()

# Configure Gemini API
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    print("WARNING: GEMINI_API_KEY not found in environment variables!")

# Initialize the model
# Using gemini-2.5-flash (or 1.5-flash if 2.5 is not available on their SDK version yet)
model = genai.GenerativeModel(
    model_name='gemini-2.5-flash',
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
            time_str = f"{now.hour:02d}:{now.minute:02d}"
            
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
                    "departures": s['departure_times'],
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
    try:
        if not api_key:
            return {"reply": "Sistem AI belum dikonfigurasi (API Key hilang). Silakan gunakan pencarian manual."}

        # Start a chat session (this is better than generate_content for function calling loops)
        chat = model.start_chat()
        
        # Send user message
        response = chat.send_message(request.message)
        
        # Check if Gemini decided to call a function
        # In the Python SDK, function_call is found inside response.parts
        func_call = None
        if response.parts:
            for part in response.parts:
                if part.function_call:
                    func_call = part.function_call
                    break

        if func_call:
            func_name = func_call.name
            func_args = {k: v for k, v in func_call.args.items()}
            
            # Execute the internal Python function (mock data for now)
            tool_result = execute_tool(func_name, func_args)
            
            # Send the tool result back to Gemini so it can generate the final natural language answer
            final_response = chat.send_message(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=func_name,
                        response={"result": tool_result}
                    )
                )
            )
            return {"reply": final_response.text}
            
        # If no function was called, just return Gemini's direct text response
        return {"reply": response.text}

    except Exception as e:
        # Fallback rule-based if Gemini API fails, times out, or quota exceeded
        print(f"Gemini API Error: {e}")
        return {
            "reply": "Maaf, sistem asisten AI sedang sibuk atau mengalami gangguan jaringan. Silakan gunakan form pencarian rute di layar utama."
        }
