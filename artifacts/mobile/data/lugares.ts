/**
 * Shared place data + neighborhood zone system.
 *
 * Imported by both the list screen (oQueFazer) and the place detail screen.
 * Zone coordinates are visual percentages over the illustrated map image —
 * not geographic. No lat/lng, no map provider.
 *
 * IMAGE RULE: every place.image is resolved via getNeighborhoodImage(localizacao).
 * Do NOT assign images manually — use the resolver so the same neighborhood
 * always shows the same image, across every card and screen.
 */

import { ImageSourcePropType } from "react-native";
import { getNeighborhoodImage } from "./neighborhoodImages";
import { getImageForEntity } from "../utils/getImageForEntity";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LugarPlace {
  id: string;
  titulo: string;
  localizacao: string; // bairro — used to look up zone
  categoria: string;
  descricao: string;
  /** Raw Supabase photo URL — use directly in <Image source={{ uri: photo_url }} /> */
  photo_url?: string | null;
  image: ImageSourcePropType | null;
  images?: ImageSourcePropType[]; // optional multi-image carousel; falls back to [image]
  preco?: string;
  xPct: number;
  yPct: number;
  // ── Action data — future Supabase fields ──
  google_maps_url?: string | null;
  instagram_handle?: string | null;
  instagram_url?: string | null;
  booking_url?: string | null;
  tipo_item?: "hotel" | "restaurante" | "experiencia";
  momento_ideal?: string | string[] | null;
}

// ── Neighborhood zone table ───────────────────────────────────────────────────
// Each zone is a visual bounding box (% of image width/height) on the
// illustrated map. Pins land at the zone center with offsets for multiples.

interface Zone {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
}
type ZoneMap = Record<string, Zone>;

const RIO_ZONES: ZoneMap = {
  // Beaches
  "Barra da Tijuca":    { xMin:  4, xMax: 23, yMin: 66, yMax: 80 },
  "São Conrado":        { xMin: 22, xMax: 33, yMin: 71, yMax: 83 },
  "Leblon":             { xMin: 35, xMax: 45, yMin: 67, yMax: 77 },
  "Ipanema":            { xMin: 43, xMax: 53, yMin: 67, yMax: 77 },
  "Arpoador":           { xMin: 52, xMax: 58, yMin: 71, yMax: 79 },
  "Copacabana":         { xMin: 57, xMax: 67, yMin: 67, yMax: 77 },
  "Leme":               { xMin: 65, xMax: 72, yMin: 64, yMax: 74 },
  // Mountains & parks
  "Corcovado":          { xMin: 31, xMax: 42, yMin: 19, yMax: 34 },
  "Floresta da Tijuca": { xMin: 13, xMax: 27, yMin: 21, yMax: 38 },
  "Pedra da Gávea":     { xMin: 29, xMax: 38, yMin: 57, yMax: 70 },
  "Morro Dois Irmãos":  { xMin: 32, xMax: 40, yMin: 53, yMax: 64 },
  // Zona Sul
  "Urca":               { xMin: 74, xMax: 88, yMin: 47, yMax: 62 },
  "Botafogo":           { xMin: 54, xMax: 66, yMin: 41, yMax: 54 },
  "Flamengo":           { xMin: 63, xMax: 72, yMin: 41, yMax: 52 },
  "Catete":             { xMin: 64, xMax: 72, yMin: 36, yMax: 46 },
  "Glória":             { xMin: 65, xMax: 73, yMin: 31, yMax: 42 },
  "Jardim Botânico":    { xMin: 42, xMax: 51, yMin: 51, yMax: 63 },
  "Lagoa":              { xMin: 47, xMax: 56, yMin: 53, yMax: 65 },
  "Gávea":              { xMin: 41, xMax: 50, yMin: 42, yMax: 54 },
  "Laranjeiras":        { xMin: 58, xMax: 67, yMin: 35, yMax: 46 },
  // Santa Teresa & Lapa
  "Santa Teresa":       { xMin: 50, xMax: 61, yMin: 24, yMax: 36 },
  "Lapa":               { xMin: 58, xMax: 68, yMin: 34, yMax: 46 },
  // Centro
  "Centro":             { xMin: 71, xMax: 83, yMin: 17, yMax: 30 },
  "Saúde":              { xMin: 74, xMax: 83, yMin: 13, yMax: 23 },
  "Gamboa":             { xMin: 73, xMax: 81, yMin: 15, yMax: 24 },
  // Zona Norte
  "Maracanã":           { xMin: 46, xMax: 57, yMin: 12, yMax: 24 },
  "Tijuca":             { xMin: 39, xMax: 50, yMin: 15, yMax: 27 },
  "São Cristóvão":      { xMin: 58, xMax: 70, yMin: 17, yMax: 28 },
  // Zona Oeste
  "Recreio":            { xMin:  1, xMax: 10, yMin: 60, yMax: 72 },
  "Parque Olímpico":    { xMin:  6, xMax: 16, yMin: 50, yMax: 63 },
};

const ZONE_OFFSETS = [
  { dx:  0.00, dy:  0.00 },
  { dx:  0.28, dy: -0.20 },
  { dx: -0.28, dy:  0.20 },
  { dx:  0.28, dy:  0.22 },
  { dx: -0.28, dy: -0.22 },
  { dx:  0.00, dy:  0.28 },
];

export function resolvePin(
  cityId: string,
  bairro: string,
  indexInZone: number,
): { xPct: number; yPct: number } {
  const zones: ZoneMap = RIO_ZONES;
  const z = zones[bairro] ?? { xMin: 45, xMax: 55, yMin: 45, yMax: 55 };
  const cx = (z.xMin + z.xMax) / 2;
  const cy = (z.yMin + z.yMax) / 2;
  const zw = z.xMax - z.xMin;
  const zh = z.yMax - z.yMin;
  const off = ZONE_OFFSETS[indexInZone % ZONE_OFFSETS.length];
  return {
    xPct: Math.round(cx + off.dx * zw),
    yPct: Math.round(cy + off.dy * zh),
  };
}

// ── Image placeholder — always null (Supabase photo_url is the only valid source) ──
function ni(_localizacao: string): null {
  return null;
}

// ── Place data by city and category ──────────────────────────────────────────

export const LUGARES_O_QUE_FAZER: Record<string, LugarPlace[]> = {
  rio: [
    {
      id: "1",
      titulo: "Praia de Ipanema",
      localizacao: "Ipanema",
      categoria: "EXPERIÊNCIA",
      descricao:
        "O encontro perfeito entre o mar e a alma carioca. Cheia de vida do nascer ao pôr do sol.",
      image: ni("Ipanema"),
      ...resolvePin("rio", "Ipanema", 0),
      tipo_item: "experiencia",
      google_maps_url: "https://maps.app.goo.gl/Praia-Ipanema",
    },
    {
      id: "2",
      titulo: "Cristo Redentor",
      localizacao: "Corcovado",
      categoria: "MONUMENTO",
      descricao:
        "A sétima maravilha do mundo moderna abraça o Rio de braços abertos. A vista do topo para a Guanabara é inesquecível.",
      image: ni("Corcovado"),
      ...resolvePin("rio", "Corcovado", 0),
    },
    {
      id: "3",
      titulo: "Pão de Açúcar",
      localizacao: "Urca",
      categoria: "EXPERIÊNCIA",
      descricao:
        "Dois picos, dois bondilhos e uma das vistas mais dramáticas do planeta. O Rio em panorama completo.",
      image: ni("Urca"),
      ...resolvePin("rio", "Urca", 0),
    },
    {
      id: "4",
      titulo: "Beco das Sardinhas",
      localizacao: "Centro",
      categoria: "SEGREDO LOCAL",
      descricao:
        "Ruelas históricas onde cariocas se reúnem ao pôr do sol para petiscos e cerveja gelada.",
      image: ni("Centro"),
      ...resolvePin("rio", "Centro", 0),
    },
    {
      id: "5",
      titulo: "Escadaria Selarón",
      localizacao: "Lapa",
      categoria: "ARTE & CULTURA",
      descricao:
        "Mosaico de azulejos de mais de 60 países, criado por Jorge Selarón ao longo de décadas.",
      image: ni("Lapa"),
      ...resolvePin("rio", "Lapa", 0),
    },
    {
      id: "6",
      titulo: "Arpoador",
      localizacao: "Arpoador",
      categoria: "RITUAL CARIOCA",
      descricao:
        "Ao pôr do sol, cariocas e viajantes sobem a pedra e aplaudem o sol desaparecer no horizonte. Um dos rituais mais bonitos do mundo.",
      image: ni("Arpoador"),
      ...resolvePin("rio", "Arpoador", 0),
    },
    {
      id: "7",
      titulo: "Santa Teresa",
      localizacao: "Santa Teresa",
      categoria: "BAIRRO",
      descricao:
        "O bairro mais bohémio do Rio, com ruas de pedra, galerias de arte, bistrôs escondidos e vistas que cortam o fôlego.",
      image: ni("Santa Teresa"),
      ...resolvePin("rio", "Santa Teresa", 0),
    },
    {
      id: "8",
      titulo: "Jardim Botânico",
      localizacao: "Jardim Botânico",
      categoria: "NATUREZA",
      descricao:
        "Mais de 8.000 espécies de plantas, uma alameda imperial de palmeiras e o silêncio da mata atlântica dentro da cidade.",
      image: ni("Jardim Botânico"),
      ...resolvePin("rio", "Jardim Botânico", 0),
    },
    // ── Home screen card entries ─────────────────────────────────────────────
    {
      id: "arcos",
      titulo: "Arcos da Lapa",
      localizacao: "Lapa",
      categoria: "PATRIMÔNIO",
      descricao:
        "Aqueduto colonial do século XVIII que virou símbolo da boemia carioca. À noite, os Arcos enquadram o bonde de Santa Teresa e iluminam a entrada da Lapa.",
      image: ni("Lapa"),
      ...resolvePin("rio", "Lapa", 1),
    },
  ],
};

// ── Onde comer — food places ──────────────────────────────────────────────────

export const LUGARES_COMER: Record<string, LugarPlace[]> = {
  rio: [
    {
      id: "c1",
      titulo: "Zuka",
      localizacao: "Leblon",
      categoria: "CONTEMPORÂNEO",
      descricao:
        "Fogão a lenha, ingredientes frescos e uma das adegas mais respeitadas do Rio. Mesa imperdível para quem leva a gastronomia a sério.",
      image: ni("Leblon"),
      ...resolvePin("rio", "Leblon", 0),
      tipo_item: "restaurante",
      google_maps_url: "https://maps.app.goo.gl/Zuka-Leblon",
      instagram_handle: "zukarestaurante",
    },
    {
      id: "c2",
      titulo: "Aprazível",
      localizacao: "Santa Teresa",
      categoria: "EXPERIÊNCIA",
      descricao:
        "Jardim suspenso no morro de Santa Teresa, com vista para a Baía de Guanabara e culinária mineira revisitada entre flores e árvores frondosas.",
      image: ni("Santa Teresa"),
      ...resolvePin("rio", "Santa Teresa", 0),
    },
    {
      id: "c3",
      titulo: "Oro",
      localizacao: "Jardim Botânico",
      categoria: "ALTA GASTRONOMIA",
      descricao:
        "Felipe Bronze e sua equipe traduzem o Brasil em pratos de precisão técnica e alma local. Estrelado e autoral.",
      image: ni("Jardim Botânico"),
      ...resolvePin("rio", "Jardim Botânico", 0),
    },
    {
      id: "c4",
      titulo: "Bar do Mineiro",
      localizacao: "Santa Teresa",
      categoria: "TRADICIONAL",
      descricao:
        "Feijoada às quartas e sábados, bolinho de bacalhau de rua e boteco com alma. O autêntico Rio de perto.",
      image: ni("Santa Teresa"),
      ...resolvePin("rio", "Santa Teresa", 1),
    },
    {
      id: "c5",
      titulo: "Lasai",
      localizacao: "Botafogo",
      categoria: "BISTRÔ",
      descricao:
        "Horta própria, menu-degustação com raízes brasileiras e uma das experiências mais honestas da cidade.",
      image: ni("Botafogo"),
      ...resolvePin("rio", "Botafogo", 0),
    },
    // ── Home screen card entries ─────────────────────────────────────────────
    {
      id: "colombo",
      titulo: "Confeitaria Colombo",
      localizacao: "Centro",
      categoria: "CAFÉ HISTÓRICO",
      descricao:
        "Um século de elegância servido em cada xícara. Vitrais art nouveau, mármore e o melhor bolo de mel do Rio — dentro do salão mais bonito da cidade.",
      image: ni("Centro"),
      ...resolvePin("rio", "Centro", 1),
      tipo_item: "restaurante",
      google_maps_url: "https://maps.app.goo.gl/Colombo-Centro",
      instagram_handle: "confeitariacolombo",
    },
    {
      id: "cobri",
      titulo: "COBRI · Bar do Mercado",
      localizacao: "Centro",
      categoria: "BAR GASTRONÔMICO",
      descricao:
        "No coração do Mercado Municipal, o COBRI transforma o entorno histórico em cenário para coquetéis autorais e petiscos com sotaque carioca.",
      image: ni("Centro"),
      ...resolvePin("rio", "Centro", 2),
      tipo_item: "restaurante",
    },
    {
      id: "banzeiro",
      titulo: "Banzeiro",
      localizacao: "Botafogo",
      categoria: "AMAZÔNICA",
      descricao:
        "O chef Jefferson Rueda traz a Amazônia para a mesa carioca — ingredientes raros, receitas centenárias e uma das experiências gastronômicas mais únicas do Brasil.",
      image: ni("Botafogo"),
      ...resolvePin("rio", "Botafogo", 1),
      tipo_item: "restaurante",
    },
  ],
};

// ── Ficar bem — hotels & stays ───────────────────────────────────────────────

export const LUGARES_FICAR: Record<string, LugarPlace[]> = {
  rio: [
    {
      id: "h1",
      titulo: "Copacabana Palace",
      localizacao: "Copacabana",
      categoria: "ÍCONE",
      descricao:
        "Um século de elegância à beira-mar. O hotel mais celebrado do Rio recebe o mundo com serviço impecável e vista para o Atlântico.",
      image: getImageForEntity("hotel", "Copacabana Palace", "Copacabana"),
      ...resolvePin("rio", "Copacabana", 0),
      tipo_item: "hotel",
      google_maps_url: "https://maps.app.goo.gl/Copacabana-Palace",
      instagram_handle: "copacabanapalace",
      booking_url: "https://www.belmond.com/hotels/south-america/brazil/rio-de-janeiro/belmond-copacabana-palace/",
    },
    {
      id: "h2",
      titulo: "Santa Teresa Hotel MGallery",
      localizacao: "Santa Teresa",
      categoria: "BOUTIQUE",
      descricao:
        "Antiga mansão colonial transformada em refúgio de design. Piscina com vista para a Baía de Guanabara e atmosfera de artista.",
      image: getImageForEntity("hotel", "Santa Teresa Hotel MGallery", "Santa Teresa"),
      ...resolvePin("rio", "Santa Teresa", 0),
    },
    {
      id: "h3",
      titulo: "Fasano Rio de Janeiro",
      localizacao: "Ipanema",
      categoria: "LUXO",
      descricao:
        "Rooftop com piscina suspensa sobre Ipanema, design Philippe Starck e o melhor endereço da Zona Sul para quem não abre mão do requinte.",
      image: getImageForEntity("hotel", "Fasano Rio de Janeiro", "Ipanema"),
      ...resolvePin("rio", "Ipanema", 0),
    },
    {
      id: "h4",
      titulo: "Mama Ruisa",
      localizacao: "Santa Teresa",
      categoria: "CHARME",
      descricao:
        "Apenas sete quartos numa villa francesa de 1920. Café da manhã em varanda, arte por toda a parte e a sensação de ser hóspede especial.",
      image: getImageForEntity("hotel", "Mama Ruisa", "Santa Teresa"),
      ...resolvePin("rio", "Santa Teresa", 1),
    },
    {
      id: "h5",
      titulo: "Yoo2 Rio de Janeiro",
      localizacao: "Botafogo",
      categoria: "DESIGN",
      descricao:
        "Conceito lifestyle no coração de Botafogo, com rooftop aberto à cidade, piscina e uma vizinhança que pulsa gastronomia e cultura.",
      image: getImageForEntity("hotel", "Yoo2 Rio de Janeiro", "Botafogo"),
      ...resolvePin("rio", "Botafogo", 0),
    },
  ],
};

// ── Lucky List — special curated picks ───────────────────────────────────────

export const LUGARES_LUCKY: Record<string, LugarPlace[]> = {
  rio: [
    {
      id: "l1",
      titulo: "Mirante do Leblon",
      localizacao: "Leblon",
      categoria: "SEGREDO LOCAL",
      descricao:
        "O pôr do sol mais silencioso do Rio. Enquanto todos vão ao Arpoador, os cariocas sobem até aqui — e ficam com a vista só para eles.",
      image: ni("Leblon"),
      ...resolvePin("rio", "Leblon", 0),
    },
    {
      id: "l2",
      titulo: "Parque Lage",
      localizacao: "Jardim Botânico",
      categoria: "DESCOBERTA",
      descricao:
        "Uma mansão neoclássica no meio da floresta com café dentro, trilha para o Cristo e patos no espelho d'água. Entrada gratuita, impacto infinito.",
      image: ni("Jardim Botânico"),
      ...resolvePin("rio", "Jardim Botânico", 0),
    },
    {
      id: "l3",
      titulo: "Pedra do Arpoador",
      localizacao: "Arpoador",
      categoria: "RITUAL CARIOCA",
      descricao:
        "Todo dia, ao pôr do sol, cariocas e viajantes sobem a pedra e aplaudem o sol desaparecendo no horizonte. Um dos rituais mais bonitos do mundo.",
      image: ni("Arpoador"),
      ...resolvePin("rio", "Arpoador", 0),
    },
    {
      id: "l4",
      titulo: "Vista Chinesa",
      localizacao: "Floresta da Tijuca",
      categoria: "MIRANTE",
      descricao:
        "Um pagode de ferro no meio da mata atlântica, com vista para a Lagoa Rodrigo de Freitas e os dois irmãos. Quase ninguém sabe que existe.",
      image: ni("Floresta da Tijuca"),
      ...resolvePin("rio", "Floresta da Tijuca", 0),
    },
    {
      id: "l5",
      titulo: "Escadaria Selarón",
      localizacao: "Lapa",
      categoria: "ARTE VIVA",
      descricao:
        "Jorge Selarón passou décadas revestindo cada degrau com azulejos de mais de 60 países. Uma obra que cresceu com o artista até o último dia de sua vida.",
      image: ni("Lapa"),
      ...resolvePin("rio", "Lapa", 0),
    },
    {
      id: "l6",
      titulo: "Biblioteca do MNBA",
      localizacao: "Centro",
      categoria: "ACHADO RARO",
      descricao:
        "O Museu Nacional de Belas Artes tem uma das coleções mais ricas do Brasil — e uma biblioteca quase desconhecida onde o tempo para. Grátis às quintas.",
      image: ni("Centro"),
      ...resolvePin("rio", "Centro", 0),
    },
    {
      id: "l7",
      titulo: "Aula de futevôlei na Barra",
      localizacao: "Barra da Tijuca",
      categoria: "EXPERIÊNCIA LOCAL",
      descricao:
        "A praia da Barra é o templo do futevôlei carioca. Aulas com jogadores da comunidade local — esporte, sol e a energia que só o Rio tem.",
      image: ni("Barra da Tijuca"),
      ...resolvePin("rio", "Barra da Tijuca", 0),
    },
    {
      id: "l8",
      titulo: "Salgado do cabeleireiro do Fashion Mall",
      localizacao: "São Conrado",
      categoria: "SEGREDO GASTRONÔMICO",
      descricao:
        "Dentro do Fashion Mall existe um cabeleireiro discreto com salgados que são, literalmente, segredo de salão. Um dos endereços preferidos de Carolina Dieckmann.",
      image: ni("São Conrado"),
      ...resolvePin("rio", "São Conrado", 0),
    },
    {
      id: "l9",
      titulo: "Melhor açaí do Rio — ASA",
      localizacao: "Leblon",
      categoria: "RITUAL CARIOCA",
      descricao:
        "O ASA não é uma sorveteria comum. É o ponto de referência do açaí autoral no Rio — cremoso, sem adição de xarope, servido da forma que deveria ser.",
      image: ni("Leblon"),
      ...resolvePin("rio", "Leblon", 1),
    },
  ],
};

export function getLugar(
  cityId: string,
  placeId: string,
): LugarPlace | undefined {
  const all = [
    ...(LUGARES_O_QUE_FAZER[cityId] ?? []),
    ...(LUGARES_COMER[cityId] ?? []),
    ...(LUGARES_FICAR[cityId] ?? []),
    ...(LUGARES_LUCKY[cityId] ?? []),
  ];
  return all.find((p) => p.id === placeId);
}
