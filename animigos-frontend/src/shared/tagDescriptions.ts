/**
 * Diccionario canónico de definiciones en español para Géneros Clásicos y Media Tags de AniList.
 * Pilar 1.1 (DRY): Centraliza las descripciones explicativas para tooltips e inspectores analíticos.
 */

export const TAXONOMY_CATEGORY_DESCRIPTIONS: Record<string, string> = {
    main_tags:
        'Etiquetas principales con una relevancia ≥ 72% votada por la comunidad en AniList. Representan el núcleo central de la trama o identidad de la obra.',
    secondary_tags:
        'Etiquetas secundarias (< 72% de relevancia) que aportan matices, subtramas, elementos de ambientación o tropos complementarios sin ser el eje absoluto.',
    Genre:
        'Clasificación macro tradicional (Acción, Drama, Fantasía, Sci-Fi, etc.) que define el tono general de la obra.',
    Theme:
        'Tropos narrativos, motores de la trama o ejes filosóficos específicos (ej. Venganza, Viajes en el Tiempo, Supervivencia, Política).',
    Cast:
        'Composición demográfica, rasgos de personalidad o arquetipos de los personajes principales (ej. Protagonista Masculino/Femenino, Anti-Héroe, Elenco Adulto).',
    Setting:
        'Época histórica, universo, localización geográfica o escenario donde transcurre la historia (ej. Histórico, Extranjero, Fantasía Urbana, Post-Apocalíptico).',
    Technical:
        'Formato narrativo, demografía editorial o técnica de producción empleada (ej. Seinen, Shounen, Episódico, CGI).',
}

const TAG_DESCRIPTIONS_MAP: Record<string, string> = {
    // --- Géneros Clásicos (Inglés y Español) ---
    Action:
        'Obras centradas en el dinamismo físico, combates, persecuciones, enfrentamientos estratégicos y secuencias de alta adrenalina.',
    Acción:
        'Obras centradas en el dinamismo físico, combates, persecuciones, enfrentamientos estratégicos y secuencias de alta adrenalina.',
    Adventure:
        'Historias de travesías, exploración de territorios desconocidos y viajes donde los protagonistas evolucionan al superar obstáculos.',
    Aventura:
        'Historias de travesías, exploración de territorios desconocidos y viajes donde los protagonistas evolucionan al superar obstáculos.',
    Comedy:
        'Narrativas diseñadas para provocar risa o entretenimiento ligero mediante situaciones absurdas, parodias, ingenio verbal o humor físico.',
    Comedia:
        'Narrativas diseñadas para provocar risa o entretenimiento ligero mediante situaciones absurdas, parodias, ingenio verbal o humor físico.',
    Drama:
        'Historias con fuerte carga emocional que profundizan en conflictos humanos, dilemas morales, pérdidas, relaciones complejas y desarrollo psicológico.',
    Fantasy:
        'Mundos o escenarios que incorporan magia, criaturas míticas, leyes sobrenaturales o reinos imaginarios ajenos a la realidad.',
    Fantasía:
        'Mundos o escenarios que incorporan magia, criaturas míticas, leyes sobrenaturales o reinos imaginarios ajenos a la realidad.',
    'Sci-Fi':
        'Ciencia ficción: explora el impacto de la ciencia avanzada, tecnología futurista, viajes espaciales, cibernética o paradojas temporales.',
    Romance:
        'Relatos cuyo eje emocional es el enamoramiento, la intimidad afectiva y los obstáculos que enfrentan dos o más personajes para estar juntos.',
    'Slice of Life':
        'Recuentos de la vida: retrata la cotidianidad, las pequeñas experiencias diarias, la amistad y la calidez humana sin depender de grandes conflictos épicos.',
    Mystery:
        'Obras estructuradas alrededor de un enigma, crimen o secreto oculto que los personajes (y el espectador) buscan descifrar mediante pistas.',
    Misterio:
        'Obras estructuradas alrededor de un enigma, crimen o secreto oculto que los personajes (y el espectador) buscan descifrar mediante pistas.',
    Suspense:
        'Narrativas que mantienen una tensión constante, incertidumbre e intriga sobre el destino de los personajes ante amenazas inminentes.',
    Suspenso:
        'Narrativas que mantienen una tensión constante, incertidumbre e intriga sobre el destino de los personajes ante amenazas inminentes.',
    Thriller:
        'Historias de alto voltaje psicológico o persecución donde el peligro, las traiciones y los giros inesperados mantienen al espectador al filo.',
    Psychological:
        'Explora la mente humana, estados alterados de conciencia, manipulación mental, traumas profundos y duelos intelectuales entre personajes.',
    Psicológico:
        'Explora la mente humana, estados alterados de conciencia, manipulación mental, traumas profundos y duelos intelectuales entre personajes.',
    Supernatural:
        'Incluye fenómenos inexplicables por las leyes físicas naturales: espíritus, maldiciones, poderes ocultos, deidades o entidades de otro plano.',
    Sobrenatural:
        'Incluye fenómenos inexplicables por las leyes físicas naturales: espíritus, maldiciones, poderes ocultos, deidades o entidades de otro plano.',
    Horror:
        'Obras orientadas a provocar miedo, inquietud, pavor o incomodidad visceral a través de lo macabro, monstruoso o psicológico.',
    Sports:
        'Historias centradas en la disciplina atlética, el trabajo en equipo, los torneos competitivos y la superación personal a través del deporte.',
    Deportes:
        'Historias centradas en la disciplina atlética, el trabajo en equipo, los torneos competitivos y la superación personal a través del deporte.',
    Mecha:
        'Obras donde robots gigantes o armaduras mecanizadas tripuladas son fundamentales para el combate y el desarrollo de la trama.',
    Music:
        'Historias donde la interpretación musical, bandas, ídolos o compositores constituyen el motor principal del relato.',
    Música:
        'Historias donde la interpretación musical, bandas, ídolos o compositores constituyen el motor principal del relato.',
    Ecchi:
        'Contenido con humor sugerente o situaciones pícaras de carácter ligero sin llegar a ser explícito.',
    Gourmet:
        'Obras centradas en el arte culinario, la preparación de platillos y la experiencia sensorial de la gastronomía.',
    'Avant Garde':
        'Obras experimentales que rompen las convenciones narrativas o visuales tradicionales mediante simbolismo y dirección artística única.',

    // --- Media Tags de AniList: Elenco / Cast ---
    'Male Protagonist':
        'La historia sigue como figura central y punto de vista principal a un personaje masculino.',
    'Female Protagonist':
        'La historia sigue como figura central y punto de vista principal a una protagonista femenina.',
    'Primarily Male Cast':
        'El elenco principal y secundario relevante está compuesto mayoritariamente por personajes masculinos.',
    'Primarily Female Cast':
        'El elenco principal y secundario relevante está compuesto mayoritariamente por personajes femeninos.',
    'Primarily Adult Cast':
        'Los personajes principales son adultos (universitarios, profesionales o veteranos), alejándose del clásico entorno escolar adolescente.',
    'Primarily Teen Cast':
        'El grupo central de personajes está formado principalmente por adolescentes en etapa de crecimiento y descubrimiento.',
    'Primarily Child Cast':
        'Los protagonistas son niños, contrastando a menudo su inocencia con la magnitud del mundo o conflicto que los rodea.',
    'Ensemble Cast':
        'Elenco coral: múltiples personajes comparten un peso narrativo similar sin que exista un único protagonista absoluto.',
    'Anti-Hero':
        'El protagonista actúa bajo su propio código moral ambiguo, empleando métodos cuestionables o egoístas en lugar del heroísmo clásico.',
    Kuudere:
        'Incluye personajes de apariencia fría, serena, inexpresiva o calculadora que reservan sus verdaderos sentimientos para un círculo íntimo.',
    Tsundere:
        'Personajes que inicialmente muestran una actitud distante, orgullosa o irritable para ocultar su afecto y vulnerabilidad.',
    Yandere:
        'Personajes cuya devoción romántica o afectiva se torna obsesiva, posesiva y potencialmente peligrosa.',
    Dandere:
        'Personajes extremadamente tímidos y silenciosos en público que logran abrirse cuando están a solas con alguien de confianza.',
    Tomboy:
        'Personajes femeninos con actitud enérgica, directa o aficiones tradicionalmente asociadas a roles masculinos.',
    Orphan:
        'El protagonista o figuras clave carecen de sus padres biológicos, marcando su independencia temprana o búsqueda de pertenencia.',
    Twins:
        'Presencia relevante de hermanos gemelos o mellizos cuya dualidad o vínculo influye en la trama.',
    Detective:
        'Sigue a investigadores privados o inspectores dedicados a resolver crímenes mediante deducción lógica.',
    Idol:
        'Trata sobre artistas del entretenimiento japonés (cantantes/bailarines), su ascenso a la fama y las exigencias de la industria.',
    Samurai:
        'Guerreros regidos por el código de la espada (Bushido) en el Japón feudal o ambientaciones inspiradas en él.',
    Vikings:
        'Guerreros, exploradores y navegantes nórdicos de la era vikinga; aborda incursiones, honor marcial, esclavitud y choques culturales en Europa.',
    Pirates:
        'Aventureros o forajidos del mar que navegan en busca de tesoros, libertad o dominio oceánico.',
    Assassins:
        'Personajes entrenados profesionalmente en el sigilo y la eliminación de objetivos por encargo político o criminal.',
    Delinquents:
        'Jóvenes rebeldes, pandilleros escolares (Yankees/Bosozoku) con códigos de honor callejero y peleas territoriales.',
    Demons:
        'Presencia central de demonios, seres infernales o entidades oscuras como antagonistas, aliados o parte del protagonista.',
    Gods:
        'Deidades, seres divinos o panteones mitológicos que intervienen directamente en el destino de los mortales.',
    Vampire:
        'Criaturas inmortales de la noche que se alimentan de sangre, explorando temas de eternidad, maldición y seducción.',
    Ghost:
        'Espíritus o almas de fallecidos que permanecen atados al mundo terrenal por asuntos pendientes.',
    Aliens:
        'Formas de vida extraterrestre cuya llegada o coexistencia altera el rumbo de la humanidad.',
    Robots:
        'Autómatas, androides o máquinas inteligentes que interactúan con humanos o cuestionan qué significa tener alma.',
    'Artificial Intelligence':
        'Sistemas informáticos conscientes o inteligencias sintéticas que desarrollan autonomía, lógica propia o emociones.',
    Dragons:
        'Criaturas dracónicas legendarias de inmenso poder mágico o destructivo dentro del ecosistema de la obra.',
    'Monster Girl':
        'Personajes femeninos que combinan rasgos humanos con especies mitológicas (arpías, lamias, centauros, slimes, etc.).',
    Kemonomimi:
        'Personajes de apariencia humana con rasgos animales sutiles como orejas y cola de felino, zorro o lobo.',

    // --- Media Tags de AniList: Temáticas / Tropos (Theme) ---
    'Coming of Age':
        'Maduración personal (Bildungsroman): sigue el tránsito psicológico y moral del protagonista desde la inocencia juvenil hacia la madurez.',
    Revenge:
        'Venganza: el motor principal del protagonista es ajustar cuentas contra quienes le arrebataron a sus seres queridos, su honor o su vida pasada.',
    Philosophy:
        'Plantea dilemas existenciales profundos sobre el sentido de la vida, la moralidad, el libre albedrío, la violencia o la naturaleza humana.',
    War:
        'Guerra: retrata conflictos bélicos a gran escala, estrategia militar, el costo humano en el frente de batalla y las consecuencias políticas.',
    Military:
        'Se desarrolla dentro de fuerzas armadas jerárquicas, academias de oficiales o escuadrones tácticos en operaciones de defensa o conquista.',
    Politics:
        'Intrigas de poder, diplomacia, golpes de estado, corrupción gubernamental y maniobras entre facciones o naciones.',
    Conspiracy:
        'Existe una red secreta, complot gubernamental o verdad oculta tras bambalinas que manipula los eventos del mundo.',
    Crime:
        'Explora el bajo mundo criminal, atracos, sindicatos del crimen, narcotráfico o la delgada línea entre la ley y el delito.',
    Swordplay:
        'Combates coreografiados con armas blancas (katanas, espadas europeas, dagas) donde la técnica y el duelo son centrales.',
    Guns:
        'Enfrentamientos tácticos con armas de fuego, tiroteos y armamento balístico moderno o futurista.',
    'Martial Arts':
        'Artes marciales: combates cuerpo a cuerpo basados en disciplinas de lucha reales o estilos internos de energía.',
    'Super Power':
        'Los personajes poseen habilidades sobrehumanas únicas (psíquicas, elementales o genéticas) con reglas propias de combate.',
    Magic:
        'Existencia de sistemas de hechicería, maná, alquimia o encantamientos que rigen el mundo o los enfrentamientos.',
    Isekai:
        'El protagonista es transportado, invocado o reencarnado desde nuestro mundo hacia un universo paralelo o de fantasía.',
    'Time Manipulation':
        'Viajes en el tiempo, bucles temporales (Time Loops), detención del tiempo o alteración de líneas temporales pasadas y futuras.',
    'Time Skip':
        'La narrativa incluye uno o más saltos temporales significativos (años o décadas) que muestran la evolución de los personajes y del mundo.',
    'Memory Manipulation':
        'Alteración, borrado o implantación de recuerdos como elemento clave del misterio o conflicto emocional.',
    Amnesia:
        'Un personaje principal ha perdido total o parcialmente sus recuerdos y debe reconstruir su identidad o pasado.',
    Survival:
        'Supervivencia extrema: los personajes luchan por mantenerse con vida en entornos hostiles, desastres o juegos mortales.',
    'Death Game':
        'Los personajes son forzados a participar en un juego o torneo letal donde la derrota implica la muerte.',
    Gore:
        'Contiene representaciones gráficas y viscerales de violencia física, heridas severas o derramamiento de sangre.',
    'Body Horror':
        'Terror corporal basado en mutaciones grotescas, parásitos, deformaciones biológicas o pérdida de la forma humana.',
    'Cosmic Horror':
        'Horror cósmico (lovecraftiano): enfrenta a los humanos con entidades incomprensibles e infinitas ante las cuales somos insignificantes.',
    Tragedy:
        'Tragedia: relatos marcados por pérdidas irreparables, destinos fatales y giros desgarradores que impactan profundamente al espectador.',
    Rehabilitation:
        'Procesos de sanación emocional, reinserción social o superación de adicciones, traumas severos o errores del pasado.',
    Bullying:
        'Aborda el acoso escolar o social, sus secuelas psicológicas y la lucha por la empatía o la redención.',
    'Found Family':
        'Familia elegida: personas sin lazos de sangre que, unidas por la adversidad o el viaje, forjan un vínculo familiar inquebrantable.',
    'Family Life':
        'Se centra en la dinámica del hogar, la crianza de los hijos, la convivencia entre hermanos o los lazos intergeneracionales.',
    Heterosexual:
        'Desarrolla relaciones románticas o afectivas centrales entre personajes de distinto sexo.',
    'Love Triangle':
        'Triángulo amoroso donde tres personajes experimentan sentimientos románticos cruzados que generan tensión emocional.',
    'Unrequited Love':
        'Amor no correspondido: explora la melancolía de amar a alguien que no comparte los mismos sentimientos.',
    'Female Harem':
        'Un protagonista masculino se ve rodeado por tres o más personajes femeninos que muestran interés romántico en él.',
    'Male Harem':
        'Una protagonista femenina es el centro de atención afectiva de múltiples personajes masculinos.',
    Yuri:
        'Historias que exploran vínculos románticos o emocionales profundos entre personajes femeninos (Girls’ Love).',
    "Boys' Love":
        'Historias centradas en relaciones románticas y afectivas entre personajes masculinos (BL / Yaoi).',
    'LGBTQ+ Themes':
        'Aborda de manera significativa la identidad de género, orientación sexual o vivencias de personajes LGBTQ+.',
    Iyashikei:
        'Subgénero "curativo": obras de ritmo pausado y atmósfera serena diseñadas para relajar, reconfortar y transmitir paz al espectador.',
    'Cute Girls Doing Cute Things':
        'CGDCT: sigue a un grupo de amigas en actividades cotidianas, clubes o pasatiempos con un tono cálido, cómico y entrañable.',
    'Cute Boys Doing Cute Things':
        'Sigue las interacciones cotidianas, clubes y amistades cómicas o relajadas de un grupo de chicos.',
    Parody:
        'Obra que imita con humor e ironía los clichés de otros géneros de anime, videojuegos o cultura pop.',
    Satire:
        'Utiliza el humor agudo, la exageración o la ironía para criticar vicios sociales, políticos o culturales.',
    Slapstick:
        'Comedia física exagerada con reacciones visuales extremas, caídas y situaciones disparatadas.',
    'Surreal Comedy':
        'Humor absurdo, ilógico yuxtapuesto con situaciones bizarras e impredecibles.',
    Meta:
        'Metanarrativa: la obra rompe la cuarta pared o reflexiona conscientemente sobre sus propios tropos como ficción.',
    Mythology:
        'Se inspira directamente en mitos, folclore y leyendas antiguas (griegas, nórdicas, sintoístas, celtas, etc.).',
    Youkai:
        'Involucra espíritus, monstruos y apariciones del folclore tradicional japonés.',
    Cultivation:
        'Protagonistas que entrenan mediante artes marciales espirituales y meditación (Xianxia/Wuxia) para alcanzar la inmortalidad o planos superiores.',
    Alchemy:
        'Uso de la alquimia (transmutación de la materia, creación de homúnculos o búsqueda de la Piedra Filosofal) como ciencia o magia.',
    Travel:
        'El viaje continuo de pueblo en pueblo o de país en país estructura los episodios y el descubrimiento del mundo.',
    Fugitive:
        'El protagonista huye constantemente de la ley, de un imperio o de una organización mientras intenta sobrevivir o limpiar su nombre.',
    Espionage:
        'Operaciones encubiertas, agentes secretos, infiltración, identidades falsas y guerra de información.',
    Terrorism:
        'Aborda ataques ideológicos o insurgentes contra el orden establecido y sus repercusiones morales.',

    // --- Media Tags de AniList: Ambientación (Setting) ---
    Historical:
        'Ambientada en un período real de la historia humana (Edad Media, Era Sengoku, Era Meiji, Siglo XIX, Guerras Mundiales, etc.).',
    Foreign:
        'Ambientación extranjera: la historia transcurre total o mayoritariamente fuera de Japón (ej. Europa, América, Medio Oriente o Asia continental).',
    Medieval:
        'Ambientada en una época de estilo medieval europeo con castillos, caballeros, feudos y combates con espada.',
    'Urban Fantasy':
        'Fantasía urbana: elementos mágicos o criaturas sobrenaturales coexisten ocultos o integrados dentro de una ciudad moderna.',
    Urban:
        'La vida metropolitana, la arquitectura de la gran ciudad y su ritmo frenético son parte esencial de la atmósfera.',
    Rural:
        'Transcurre en el campo, aldeas tranquilas o pueblos costeros alejados de las grandes metrópolis.',
    School:
        'El instituto o academia estudiantil es el escenario principal donde conviven y se relacionan los personajes.',
    'School Club':
        'La trama gira alrededor de las actividades extracurriculares de un club estudiantil (cultural, deportivo o artístico).',
    Work:
        'Ambientación laboral: muestra la vida de oficina, estudios creativos, comercios o profesiones adultas.',
    Space:
        'El espacio exterior, naves interestelares, estaciones orbitales o planetas lejanos conforman el escenario.',
    'Post-Apocalyptic':
        'Transcurre después de un cataclismo global que colapsó la civilización humana.',
    Dystopian:
        'Sociedad futura o alternativa opresiva, totalitaria o deshumanizada bajo una aparente fachada de orden.',
    Cyberpunk:
        'Futuro de "alta tecnología y baja calidad de vida": megacorporaciones, implantes cibernéticos, hackers y decadencia urbana.',
    Steampunk:
        'Mundo retrofuturista impulsado por máquinas de vapor, engranajes e estética industrial del siglo XIX.',
    Dungeon:
        'Exploración de mazmorras subterráneas, laberintos o torres repletas de monstruos, trampas y tesoros.',
    'Alternate Universe':
        'Universo alternativo con leyes históricas o físicas distintas a las de nuestra línea temporal.',
    'Achronological Order':
        'Los episodios o escenas se presentan en orden no lineal (saltando entre pasado, presente y futuro) para construir un rompecabezas narrativo.',

    // --- Demografía y Técnica (Technical / Demographic) ---
    Seinen:
        'Demografía editorial dirigida a un público adulto/joven adulto: suele abordar tramas más complejas, psicológicas, políticas o realistas.',
    Shounen:
        'Demografía juvenil orientada a la acción, el compañerismo, la superación constante y grandes aventuras.',
    Shoujo:
        'Demografía centrada en las relaciones interpersonales, el crecimiento emocional y el romance con gran expresividad visual.',
    Josei:
        'Demografía dirigida a mujeres adultas, retratando el romance, la vida laboral y los vínculos humanos con mayor realismo y madurez.',
    Episodic:
        'Formato episódico: cada capítulo narra una historia autoconclusiva o un caso independiente dentro de un hilo conductor mayor.',
    CGI:
        'Integra animación generada por computadora (3D) de forma prominente en secuencias de acción, mechas o escenarios.',
    'Full CGI':
        'Obra animada íntegramente mediante gráficos 3D por computadora.',
}

/**
 * Devuelve una explicación clara en español para cualquier género o Media Tag de AniList.
 * Si el tag no está en el diccionario curado, genera una explicación contextual según su categoría.
 */
export function getTagDescription(tagName: string, category?: string, isMainTag?: boolean): string {
    const clean = tagName.trim()
    if (TAG_DESCRIPTIONS_MAP[clean]) {
        return TAG_DESCRIPTIONS_MAP[clean]
    }

    // Búsqueda case-insensitive
    const lower = clean.toLowerCase()
    for (const [k, v] of Object.entries(TAG_DESCRIPTIONS_MAP)) {
        if (k.toLowerCase() === lower) return v
    }

    const tierText = isMainTag
        ? 'Es una etiqueta principal (Main Tag) con alto peso en la identidad de las obras donde aparece.'
        : 'Actúa como etiqueta complementaria (Secondary Tag) que aporta matices específicos a la obra.'

    if (category === 'Cast') {
        return `Arquetipo o característica del elenco ("${clean}") según la taxonomía de AniList. Define los rasgos, rol o composición de los personajes de la historia. ${tierText}`
    }
    if (category === 'Setting') {
        return `Elemento de ambientación ("${clean}") en la taxonomía de AniList. Define el entorno, época o escenario donde se desarrolla el relato. ${tierText}`
    }
    if (category === 'Genre') {
        return `Género temático ("${clean}") que clasifica el tono narrativo y estilo general de las obras que lo comparten.`
    }
    if (category === 'Technical') {
        return `Rasgo técnico, narrativo o demográfico ("${clean}") que describe la estructura o público objetivo de la producción. ${tierText}`
    }

    return `Tropo o temática narrativa ("${clean}") registrada en la base de datos de Media Tags de AniList. Identifica un motivo recurrente en la trama de tus obras vistas. ${tierText}`
}
