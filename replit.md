# Overview

This project is a pnpm monorepo using TypeScript, designed to build a mobile travel application called "The Lucky Trip" and its supporting API. The core purpose is to provide users with curated travel content for Rio de Janeiro, including AI-powered itinerary planning, local recommendations, and a premium subscription model.

The mobile app, built with Expo React Native, focuses on an image-driven, dark glassmorphism aesthetic. It integrates with a PostgreSQL database via Drizzle ORM and Supabase for backend services, authentication, and serverless functions. The API server, developed with Express 5, provides data and handles Stripe integrations for subscriptions.

The project aims to offer a seamless and personalized travel planning experience, leveraging AI for itinerary generation and rich content to guide users through their journey.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize core functionality and established patterns. For any significant architectural modifications or new feature implementations, please ask for confirmation before proceeding. Ensure that all code adheres to the defined styling and architectural guidelines, particularly regarding the image resolution system and AI architecture. Do not make changes to `MapZoneOverlay.tsx`.

# System Architecture

## Monorepo Structure
The project is organized as a pnpm monorepo with `artifacts` for deployable applications (e.g., `api-server`, `mobile`), `lib` for shared libraries (e.g., `db`, `api-spec`, `api-client-react`, `api-zod`, `supabase`), and `scripts` for utility functions. TypeScript is used throughout, with a composite project setup for efficient type-checking and declaration emission.

## API Server (`artifacts/api-server`)
An Express 5 API server handles backend logic. It uses Zod for request/response validation and Drizzle ORM for PostgreSQL interactions. API specifications are defined using OpenAPI and generate client and Zod schemas via Orval.

## Mobile Application (`artifacts/mobile`)
A React Native application built with Expo (SDK 54) features a dark glassmorphism design.
- **UI/UX Decisions**:
    - **Color Scheme**: Predominantly white text, gold accents (`#D4AF37`), and pure black overlays. Backgrounds utilize real destination images with dark overlays. All brown/cream colors are removed.
    - **Glass Cards**: `rgba(255,255,255,0.08–0.14)` background with `rgba(255,255,255,0.15)` border.
    - **Typography**: Playfair Display (headings) and Inter (body text).
    - **Shadows**: `boxShadow` is used consistently over `shadow*` props.
- **Image Resolution**: A unified 4-tier image resolution system (`getImageForEntity`) ensures consistent image loading across entities (Supabase `photo_url`, Wikipedia Commons, `getNeighborhoodImage` fallback, local assets). `getNeighborhoodImage(name)` is a single source of truth for neighborhood images.
- **Navigation**: Uses a 5-tab navigator with structured routing for different sections like "Onde Ficar" (hotels), "Comer Bem" (restaurants), "O Que Fazer" (activities), and "Lucky List".
- **Map Components**: `OndeFicarMap.tsx` provides an interactive aerial map with hotspots, and `MapZoneOverlay.tsx` is a zone-based interactive map.

## AI Architecture
Supabase is the canonical source of truth for all AI operations. The system orchestrates AI interactions without inventing data.
- **AI Provider**: Primarily Gemini 2.0 Flash (`GEMINI_API_KEY`), with OpenAI GPT-4o-mini as a fallback.
- **Roteiro Planner (`supabase/functions/generate-itinerary`)**: A 7-step pipeline enriches data, classifies periods, scores preferences, geographically clusters items, builds a draft itinerary, and refines it using Gemini. Gemini is restricted to reordering items within periods.
- **Lucky Concierge (`supabase/functions/lucky-concierge`)**: Handles intent routing and queries Supabase tables, leveraging Gemini for natural language processing without generating new data.

## Itinerary Generation & Persistence
Itinerary generation is handled by a `POST /api/friend/generate-itinerary` endpoint. It reads friend guide data from Supabase, sends a structured prompt to Gemini, validates returned `place_id`s, and persists the generated itinerary into `user_itineraries` and `roteiro_itens` tables. Auto-save and sharing features are built around this persistence.

## Premium Paywall System
The `GuiaContext` manages the user's premium status, loaded from AsyncStorage and Supabase `access_levels`.
- **PaywallModal**: A global modal for "discovery," "lucky," and "depth" paywall types.
- **Subscription**: An annual/monthly subscription model handled via Stripe checkout.
- **Feature Gating**: Limits free usage for Lucky List items (3 free), AI questions (2 free), and saved places (1 free).

# External Dependencies

- **Database**: PostgreSQL (managed by Supabase)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **API Framework**: Express 5
- **API Codegen**: Orval (generates from OpenAPI spec)
- **Build Tool**: esbuild
- **Cloud Backend & Authentication**: Supabase (including Supabase functions for AI)
- **AI Models**: Google Gemini 2.0 Flash, OpenAI GPT-4o-mini (fallback)
- **Payment Processing**: Stripe (Checkout, Webhooks)
- **Mobile Framework**: Expo React Native
- **Data Fetching**: React Query
- **Mapping**: Google Places API (for photo enrichment and autocomplete)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `REPLIT_DEV_DOMAIN`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_PLACES_KEY`.