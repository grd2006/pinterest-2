// filepath: c:\My Stuff\Filesss\Tailwind\pinterest-2\app\api\uploadthing\route.js
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});