import catalog from "../../../backend/data/batam-locations.json";

// One catalog shared with the backend resolver; no client geocoder or guessed coordinates.
export const batamLocations = catalog.map(location => ({ ...location, coords: `${location.lat}, ${location.lng}` }));
