type DMSCoordinate = {
  deg: number
  mins: number
  secs: number
  bearing: 'N' | 'S' | 'E' | 'W'
}

type DMSResult = {
  latitude: DMSCoordinate
  longitude: DMSCoordinate
}

const decimalToDMS = (
  value: number = 0,
  positiveBearing: 'N' | 'E',
  negativeBearing: 'S' | 'W',
): DMSCoordinate => {
  const abs = Math.abs(value)

  let deg = Math.floor(abs)
  let minsFloat = (abs - deg) * 60
  let mins = Math.floor(minsFloat)
  let secs = Math.round((minsFloat - mins) * 60)

  // Fix rounding overflow (e.g. 59.9999 → 60)
  if (secs === 60) {
    secs = 0
    mins += 1
  }

  if (mins === 60) {
    mins = 0
    deg += 1
  }

  return {
    deg,
    mins,
    secs,
    bearing: value < 0 ? negativeBearing : positiveBearing,
  }
}

export const dmsCoordinates = (lat: number = 0, lng: number = 0): DMSResult => {
  return {
    latitude: decimalToDMS(lat, 'N', 'S'),
    longitude: decimalToDMS(lng, 'E', 'W'),
  }
}
