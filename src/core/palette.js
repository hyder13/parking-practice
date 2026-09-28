/**
 * 全場唯一的調色盤。沿用 sakura-crossing 的思路:偏暖的淺色、灰紫色路面、
 * 偏青的綠,飽和色只留給焦點物件(玩家車、目標車格、警示)。
 */
export const PAL = {
  // sky & atmosphere
  skyTop: 0x8fbdea,
  skyMid: 0xd4e8fa,
  skyHaze: 0xfbe7e9,
  cloud: 0xfdfaf8,
  cloudShade: 0xe6e6f2,
  fog: 0xe6ecf7,
  hill: 0xc6cfe6,
  hillFar: 0xd8dded,

  // light
  sun: 0xfff1d8,
  fill: 0xa9bdf5,
  hemiSky: 0xdcecff,
  hemiGround: 0xb6a6c6,

  // ink
  ink: 0x39324f,

  // ground
  asphalt: 0x817d90,
  road: 0x8e8a9c,
  lineWhite: 0xf6f4f8,
  lineYellow: 0xf0c341,
  sidewalk: 0xdcd8e2,
  curb: 0xc7c2d0,
  concrete: 0xd9d5dd,
  concreteDark: 0xa7a2b0,
  grass: 0x86ab84,
  targetFill: 0x3ecf8e,

  // nature / props
  leaf: 0x6fa98a,
  leafDark: 0x578f76,
  trunk: 0x7a5f55,
  pole: 0x9a97a8,
  lamp: 0xfff6d8,
  building: [0xf0dcda, 0xe8e4dc, 0xd6dde6, 0xe9dfcc, 0xcfd8d0, 0xdcd3e4],
  roofTone: [0x8f8aa6, 0x9a7f86, 0x7f94a0],
  window: 0x7f93ad,

  // vehicles
  glass: 0x9dc0d4,
  glassDark: 0x53627a,
  tire: 0x3a3548,
  rim: 0xd9d8e2,
  trim: 0x4f4a63,
  interior: 0x4a4458,
  seat: 0x6d5f6b,
  headlight: 0xfff6d8,
  tail: 0xd8403c,
  parked: [0xe9e7ee, 0xbfc3cf, 0x4d4a5e, 0x8c3b48, 0x3f5f93, 0x9aa7b8, 0xb3c2a4, 0xd9c29a, 0x6c7c73],

  // person
  person: 0x3f6fd8,
  skin: 0xf3d2b8,
  hair: 0x3b3040,
};
