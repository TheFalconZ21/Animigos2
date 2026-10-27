// Devuelve una copia de la lista en orden aleatorio (Fisher-Yates)
export function mezclar<T>(lista: T[]): T[] {
    const copia = [...lista]
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copia[i], copia[j]] = [copia[j], copia[i]]
    }
    return copia
}
