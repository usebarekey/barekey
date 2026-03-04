import { defineApp } from "convex/server";
import autumnComponent from "@useautumn/convex/convex.config";

const app = defineApp();

app.use(autumnComponent);

export default app;
