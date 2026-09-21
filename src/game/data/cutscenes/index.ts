import { ENDING_CUTSCENE } from "./ending";
import { INTRO_CUTSCENE } from "./intro";
import { WORLD_CUTSCENES } from "./worlds";

export const CUTSCENE_SCRIPTS = [INTRO_CUTSCENE, ...WORLD_CUTSCENES, ENDING_CUTSCENE] as const;
export { ENDING_CUTSCENE, INTRO_CUTSCENE, WORLD_CUTSCENES };
