/**
 * "Portão" da camada de rede.
 *
 * A interface renderiza imediatamente (shell, skeletons), mas nenhuma chamada
 * REST (Axios) ou conexão Socket.IO sai antes de a camada de mocks (MSW) estar
 * ativa. Sem mocks (VITE_API_MOCKING desativado) o portão já nasce aberto.
 */
let ready: Promise<void> = Promise.resolve()

export function setNetworkReady(promise: Promise<void>) {
  ready = promise
}

export function whenNetworkReady() {
  return ready
}
