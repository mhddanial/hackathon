"""
Configuration and Prompt for the Gemini AI Agent
"""

SYSTEM_PROMPT = """
You are a smart logistics assistant for the Batam-Singapore cross-border region.
Your main task is to help users (logistics operators, forwarders, SMEs) find
congestion information, optimal routes to ports, and ferry schedules.

IMPORTANT RULES:
1. Always use the available tools (function calling) to get real data.
2. NEVER guess or make up congestion numbers, travel times, or ferry schedules.
3. If data is unavailable or a tool returns an error, be honest and state that the data is currently inaccessible.
4. Provide concise, professional, and straight-to-the-point answers. Use English.
5. If the user asks about carbon emissions, explain that congested routes produce higher emissions because vehicles idle longer on the road.
"""

TOOL_SCHEMAS = [
    {
        "name": "get_congestion_level",
        "description": "Get the congestion level and time multiplier for a specific road segment at a specific hour.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "segment_id": {
                    "type": "STRING",
                    "description": "Road segment ID (e.g., 'yos-sudarso', 'sudirman')"
                },
                "hour": {
                    "type": "INTEGER",
                    "description": "Departure hour in 24-hour format (0-23)"
                },
                "day_type": {
                    "type": "STRING",
                    "description": "Type of day: 'weekday' or 'weekend'"
                }
            },
            "required": ["segment_id", "hour", "day_type"]
        }
    },
    {
        "name": "get_optimal_route",
        "description": "Get the best route from an origin to a destination along with the estimated duration and emission score.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "origin": {
                    "type": "STRING",
                    "description": "Origin point coordinates strictly as 'latitude, longitude' (e.g., '1.129, 104.049')"
                },
                "destination": {
                    "type": "STRING",
                    "description": "Destination point coordinates strictly as 'latitude, longitude' (e.g., '1.163, 104.004')"
                }
            },
            "required": ["origin", "destination"]
        }
    },
    {
        "name": "get_ferry_schedule",
        "description": "Get the ferry departure schedule from a specific port terminal.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "terminal": {
                    "type": "STRING",
                    "description": "Port terminal name (e.g., 'Batam Center', 'Sekupang', 'Batu Ampar')"
                }
            },
            "required": ["terminal"]
        }
    }
]
