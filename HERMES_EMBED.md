# Hermes /village embed (optional, Phase 2)
# Standalone village already runs on http://127.0.0.1:8787 for BOTH Hermes and OpenCode.
# To embed inside Hermes web dashboard, create:
#   hermes-agent/web/src/pages/VillagePage.tsx
# with:
#   export default function VillagePage() {
#     return <iframe src="http://127.0.0.1:8787" style={{width:'100%',height:'100%',border:0}} title="village" />;
#   }
# Then in hermes-agent/web/src/App.tsx add lazy route:
#   const VillagePage = lazy(()=>import("@/pages/VillagePage"));
#   BUILTIN_ROUTES_CORE["/village"] = VillagePage
#   BUILTIN_NAV_REST push {path:"/village", label:"Village"}
# Until then, open the URL directly — same state contract (TEAM/state.json narrow waist).
