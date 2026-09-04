export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    specifier = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      !/\.[a-z]+$/i.test(specifier)
    ) {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch (typescriptError) {
        if (typescriptError?.code === "ERR_MODULE_NOT_FOUND") {
          return nextResolve(`${specifier}.tsx`, context);
        }
        throw typescriptError;
      }
    }
    throw error;
  }
}
