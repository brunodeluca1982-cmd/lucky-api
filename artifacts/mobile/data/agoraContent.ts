/**
 * Shared content for the "O que fazer agora" feature.
 *
 * Imported by:
 *  – app/cidade/[id].tsx   → derive the "Agora no …" button label + pinnedId
 *  – app/agoraNoRio/[id].tsx → render content, pin the hero item
 *
 * placeId: if set, the detail page `/lugar/{city}/{placeId}` exists and the
 *   card will navigate there. If undefined the card is still shown but
 *   tapping does nothing (future: link when place is added).
 */

import { ImageSourcePropType } from "react-native";
import { Periodo } from "@/data/mockData";
import { getNeighborhoodImage } from "@/data/neighborhoodImages";

export interface AgoraItem {
  id: string;
  titulo: string;
  localizacao: string;
  tag: string;
  descricao: string;
  image: ImageSourcePropType;
  placeId?: string;
}

export interface DestaquePick {
  titulo: string;
  localizacao: string;
  tag: string;
  image: ImageSourcePropType;
}

export const AGORA_CONTENT: Record<string, Record<Periodo, AgoraItem[]>> = {};

export const FALLBACK_CONTENT: Record<Periodo, AgoraItem[]> = {
  manha: [],
  tarde: [],
  noite: [],
};

export const DESTAQUE_PRINCIPAL: Record<Periodo, DestaquePick[]> = {
  manha: [],
  tarde: [],
  noite: [],
};
