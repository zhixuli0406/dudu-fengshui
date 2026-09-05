declare module 'geomagnetism' {
  interface Point { decl: number; incl: number; h: number; f: number; x: number; y: number; z: number }
  interface Model { point(coords: [number, number] | [number, number, number]): Point }
  export function model(date?: Date): Model
}
