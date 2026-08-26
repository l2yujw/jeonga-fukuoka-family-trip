export const LANDING_PLATE_WIDTH = 853;
export const LANDING_PLATE_MAX_WIDTH = 430;
export const LANDING_MIN_HIT_HEIGHT = 44;

export const LANDING_CONTROL_GEOMETRY = {
  input: { top: 1128, height: 85 },
  submit: { top: 1235, height: 83 },
} as const;

export type LandingControl = keyof typeof LANDING_CONTROL_GEOMETRY;

export function getLandingControlHitHeight(
  viewportWidth: number,
  control: LandingControl,
) {
  const plateWidth = Math.min(viewportWidth, LANDING_PLATE_MAX_WIDTH);
  const bakedHeight =
    LANDING_CONTROL_GEOMETRY[control].height * plateWidth / LANDING_PLATE_WIDTH;

  return Math.max(LANDING_MIN_HIT_HEIGHT, bakedHeight);
}
