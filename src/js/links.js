// Enlaces externos generados a partir de texto validado; nunca se aceptan URLs desde los datos.
export const wazeUrl = (query) => `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
export const googleMapsUrl = (query) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`;
