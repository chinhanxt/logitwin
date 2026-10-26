# Third-party components

Installed versions are pinned by `package-lock.json`; preserve dependency license files when distributing.

| Component | Version checked | License / source |
|---|---|---|
| React / react-dom | 19.3.0 | MIT, local package metadata |
| Tabler React icons | 3.49.0 | MIT, local package metadata |
| Vite | 7.3.7 | MIT, local package metadata |
| jose | 6.2.12 | MIT, local package metadata |
| bpmn-engine | 26.0.5 | MIT, [source](https://github.com/paed01/bpmn-engine) |
| Three.js / R3F / drei | versions in lockfile | MIT, local package license files |
| Keycloak | 26.6.3 | Apache-2.0, [source](https://github.com/keycloak/keycloak) |
| Be Vietnam Pro | local font files | SIL OFL, `public/fonts/OFL.txt` |
| Ollama | existing local runtime | [source/license](https://github.com/ollama/ollama), runtime separate from model terms |
| Gemma2 2B Q4 | existing local weights | [Gemma Terms of Use](https://ai.google.dev/gemma/terms); do not label weights MIT/Apache or OSI open-source |
| bge-m3 | existing local weights | [official model card](https://huggingface.co/BAAI/bge-m3); model/runtime licenses are separate |

No model weights are included in the project. Ollama generation/embedding contracts follow [Generate API](https://docs.ollama.com/api/generate), [Embed API](https://docs.ollama.com/api/embed) and [Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs).

OIDC follows [Keycloak OIDC documentation](https://www.keycloak.org/securing-apps/oidc-layers); local container configuration follows [Keycloak container guide](https://www.keycloak.org/server/containers). Development mode is scoped to this machine.

The project source has not yet been published or assigned a final distribution license. Choose the project license before competition repository publication and preserve all third-party notices.
