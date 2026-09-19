"""
Configuration and prompt for the OpenAI-compatible AI agent.
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
6. When returning an optimal route, always mention the departure time used for the calculation. If the route has MEDIUM or HIGH congestion, proactively suggest that departing during an off-peak time (e.g., early morning 06:00) would significantly reduce both travel time and carbon emissions.
"""

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_congestion_level",
            "description": "Get the congestion level and time multiplier for a specific road segment at a specific hour.",
            "parameters": {
                "type": "object",
                "properties": {
                    "segment_id": {
                        "type": "string",
                        "description": "Road segment ID (e.g., 'yos-sudarso', 'sudirman')"
                    },
                    "hour": {
                        "type": "integer",
                        "description": "Departure hour in 24-hour format (0-23)"
                    },
                    "day_type": {
                        "type": "string",
                        "description": "Type of day: 'weekday' or 'weekend'"
                    }
                },
                "required": ["segment_id", "hour", "day_type"],
                "additionalProperties": False,
            },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_optimal_route",
            "description": "Get the best route from an origin to a destination along with the estimated duration and emission score.",
            "parameters": {
                "type": "object",
                "properties": {
                    "origin": {
                        "type": "string",
                        "description": "Origin point coordinates strictly as 'latitude, longitude' (e.g., '1.129, 104.049')"
                    },
                    "destination": {
                        "type": "string",
                        "description": "Destination point coordinates strictly as 'latitude, longitude' (e.g., '1.163, 104.004')"
                    },
                    "time": {
                        "type": "string",
                        "description": "Optional departure time in 24-hour format (e.g., '08:00', '17:30')"
                    }
                },
                "required": ["origin", "destination"],
                "additionalProperties": False,
            },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_ferry_schedule",
            "description": "Get the ferry departure schedule from a specific port terminal.",
            "parameters": {
                "type": "object",
                "properties": {
                    "terminal": {
                        "type": "string",
                        "description": "Port terminal name (e.g., 'Batam Center', 'Sekupang', 'Batu Ampar')"
                    }
                },
                "required": ["terminal"],
                "additionalProperties": False,
            },
        }
    }
]
