// 1. Importamos tu nuevo componente modular
import { Navbar } from './components/Navbar'
import { LoginModal } from './components/LoginModal' // 1. Importamos
import { HeroShowcaseBg } from './components/HeroShowcaseBg' // 1. Importamos el fondo

function App() {
  return (
    <>
      {/* 1. Header arriba */}
      <Navbar />

      {/* 2. Sección Hero con el Showcase en el fondo */}
      <section className="position-relative overflow-hidden py-12 my-6">
        {/* Fondo animado estilo Steam Showcase */}
        <HeroShowcaseBg />

        {/* 2. Tu Hero Section (ahora subirá al recuadro rojo superior) */}
        <div className="container mx-auto my-12 py-12 position-relative z-2">
          <header className="row justify-content-center">
            <div className="col-12 col-lg-10 text-center">
              <h1 className="hero-title fw-bold mb-2">
                {"ANIMIGOS".split("").map((letra, index) => (
                  <span key={index} className="hover-letter">
                    {letra}
                  </span>
                ))}
              </h1>
              <p className="fs-lg text-secondary mb-0">
                Descubre y vota anime en grupo con felicidad garantizada
              </p>
            </div>
          </header>
        </div>
      </section>

      {/* 3. El Modal vive abajo del todo */}
      <LoginModal />
    </>
  )
}


export default App
