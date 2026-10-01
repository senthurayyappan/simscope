// Ambient types for deep imports the packages do not type.
declare module "lucide-react/dist/esm/icons/*.mjs" {
  export const __iconData: { name: string; size: number; node: [string, Record<string, string | number>][] };
  const icon: unknown;
  export default icon;
}
declare module "*.css";
