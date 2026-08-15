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
# Mock Tool Functions (Until Database/OSRM are ready)
# ---------------------------------------------------------
def execute_tool(function_name: str, args: dict):
    """Router to execute the correct mock tool based on Gemini's request"""
    if function_name == "get_congestion_level":
        return {
            "segment_id": args.get("segment_id"),
            "hour": args.get("hour"),
            "day_type": args.get("day_type"),
            "congestion_level": "High", 
            "multiplier": 1.8,
            "note": "This is mock data from backend."
        }
    elif function_name == "get_optimal_route":
        return {
            "origin": args.get("origin"),
            "destination": args.get("destination"),
            "recommended_departure": "08:00",
            "estimated_duration_min": 45,
            "emission_score": "Medium",
            "note": "This is mock data from backend."
        }
    elif function_name == "get_ferry_schedule":
        return {
            "terminal": args.get("terminal"),
            "departures": ["08:00", "10:00", "12:00", "14:00", "16:00"],
            "note": "This is mock data from backend."
        }
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
