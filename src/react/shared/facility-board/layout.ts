import type { FacilitySelectionKey } from './types';

export const FACILITY_ROOM_NUMBERS: Record<FacilitySelectionKey, number> = { a: 1, b: 2, dark: 3, print: 4, gear: 5 };

export type FacilityLayoutEntry = { key: string; x: number; w: number; lower?: boolean; stairs?: boolean; interactive?: FacilitySelectionKey };
/** User-approved corridor-v1 coordinates. Context rooms deliberately have no names or actions. */
export const FACILITY_LAYOUT: FacilityLayoutEntry[] = [
  {key:'context-1',x:0,w:230},{key:'context-2',x:230,w:200},
  {key:'print',x:430,w:200,interactive:'print'},{key:'context-3',x:630,w:112},
  {key:'a',x:742,w:210,interactive:'a'},{key:'context-4',x:952,w:120},
  {key:'context-5',x:1072,w:220},{key:'gear',x:1292,w:308,interactive:'gear'},
  {key:'stairs-left',x:430,w:200,lower:true,stairs:true},
  {key:'context-6',x:630,w:100,lower:true},{key:'context-7',x:730,w:200,lower:true},
  {key:'b',x:930,w:210,lower:true,interactive:'b'},{key:'dark',x:1140,w:140,lower:true,interactive:'dark'},
  {key:'context-8',x:1280,w:150,lower:true},{key:'stairs-right',x:1430,w:130,lower:true,stairs:true}
];
export const FACILITY_SELECTION_ORDER: FacilitySelectionKey[] = ['print','a','gear','b','dark'];
