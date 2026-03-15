import type {
  ClientProfileMemory,
  HairColorName,
  HeroPresetId,
  PersistedPortraitAsset,
} from "./types";

const CLIENT_PROFILE_STORAGE_KEY = "hairmatch.client-profile.v1";
const PORTRAIT_DATABASE_NAME = "hairmatch-client-assets";
const PORTRAIT_STORE_NAME = "portrait-assets";
const ACTIVE_PORTRAIT_ASSET_ID = "active-portrait";

function isPresetId(value: unknown): value is HeroPresetId {
  return (
    value === "precision-bob" ||
    value === "italian-bob" ||
    value === "soft-lob" ||
    value === "face-frame-flip" ||
    value === "curtain-cloud" ||
    value === "curtain-gloss" ||
    value === "butterfly-blowout" ||
    value === "sleek-midi" ||
    value === "modern-shag" ||
    value === "bixie-air" ||
    value === "volume-waves" ||
    value === "ribbon-waves"
  );
}

function isHairColor(value: unknown): value is HairColorName {
  return (
    value === "soft-black" ||
    value === "espresso" ||
    value === "chestnut" ||
    value === "copper" ||
    value === "golden-blonde"
  );
}

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function createEmptyClientProfile(): ClientProfileMemory {
  return {
    summary: "",
    favoritePresetIds: [],
    rejectedPresetIds: [],
    preferredColors: [],
    maintenancePreference: "flexible",
    recentNotes: [],
    lastPresetId: null,
    portraitAssetId: null,
    updatedAt: null,
    faceProfile: null,
  };
}

function sanitizeProfile(candidate: unknown): ClientProfileMemory {
  if (!candidate || typeof candidate !== "object") {
    return createEmptyClientProfile();
  }

  const parsed = candidate as Record<string, unknown>;

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    favoritePresetIds: Array.isArray(parsed.favoritePresetIds)
      ? dedupe(parsed.favoritePresetIds.filter(isPresetId))
      : [],
    rejectedPresetIds: Array.isArray(parsed.rejectedPresetIds)
      ? dedupe(parsed.rejectedPresetIds.filter(isPresetId))
      : [],
    preferredColors: Array.isArray(parsed.preferredColors)
      ? dedupe(parsed.preferredColors.filter(isHairColor))
      : [],
    maintenancePreference:
      parsed.maintenancePreference === "low" ||
      parsed.maintenancePreference === "medium" ||
      parsed.maintenancePreference === "high" ||
      parsed.maintenancePreference === "flexible"
        ? parsed.maintenancePreference
        : "flexible",
    recentNotes: Array.isArray(parsed.recentNotes)
      ? parsed.recentNotes
          .filter((note): note is string => typeof note === "string" && Boolean(note.trim()))
          .slice(-6)
      : [],
    lastPresetId: isPresetId(parsed.lastPresetId) ? parsed.lastPresetId : null,
    portraitAssetId:
      typeof parsed.portraitAssetId === "string" ? parsed.portraitAssetId : null,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    faceProfile:
      parsed.faceProfile && typeof parsed.faceProfile === "object"
        ? {
            faceShape:
              typeof (parsed.faceProfile as Record<string, unknown>).faceShape === "string"
                ? ((parsed.faceProfile as Record<string, unknown>).faceShape as string)
                : "unknown",
            hairTexture:
              typeof (parsed.faceProfile as Record<string, unknown>).hairTexture === "string"
                ? ((parsed.faceProfile as Record<string, unknown>).hairTexture as string)
                : "unknown",
            skinTone:
              typeof (parsed.faceProfile as Record<string, unknown>).skinTone === "string"
                ? ((parsed.faceProfile as Record<string, unknown>).skinTone as string)
                : "unknown",
          }
        : null,
  };
}

export function loadClientProfileMemory() {
  if (typeof window === "undefined") {
    return createEmptyClientProfile();
  }

  try {
    const raw = window.localStorage.getItem(CLIENT_PROFILE_STORAGE_KEY);

    if (!raw) {
      return createEmptyClientProfile();
    }

    return sanitizeProfile(JSON.parse(raw));
  } catch (error) {
    console.warn("Unable to read HairMatch client memory:", error);
    return createEmptyClientProfile();
  }
}

export function saveClientProfileMemory(profile: ClientProfileMemory) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CLIENT_PROFILE_STORAGE_KEY,
      JSON.stringify({
        ...profile,
        favoritePresetIds: dedupe(profile.favoritePresetIds),
        rejectedPresetIds: dedupe(profile.rejectedPresetIds),
        preferredColors: dedupe(profile.preferredColors),
        recentNotes: profile.recentNotes.slice(-6),
      })
    );
  } catch (error) {
    console.warn("Unable to persist HairMatch client memory:", error);
  }
}

export function mergeClientProfile(
  current: ClientProfileMemory | null,
  patch: Partial<ClientProfileMemory>
): ClientProfileMemory {
  const base = current || createEmptyClientProfile();

  return {
    ...base,
    ...patch,
    favoritePresetIds: dedupe(
      patch.favoritePresetIds ?? base.favoritePresetIds
    ).filter(isPresetId),
    rejectedPresetIds: dedupe(
      patch.rejectedPresetIds ?? base.rejectedPresetIds
    ).filter(isPresetId),
    preferredColors: dedupe(
      patch.preferredColors ?? base.preferredColors
    ).filter(isHairColor),
    recentNotes: (patch.recentNotes ?? base.recentNotes).slice(-6),
    updatedAt: new Date().toISOString(),
  };
}

export function describeClientProfile(profile: ClientProfileMemory | null) {
  const current = profile || createEmptyClientProfile();
  const parts: string[] = [];

  if (current.summary) {
    parts.push(current.summary);
  }

  if (current.favoritePresetIds.length > 0) {
    parts.push(`Loved: ${current.favoritePresetIds.join(", ")}`);
  }

  if (current.rejectedPresetIds.length > 0) {
    parts.push(`Avoid: ${current.rejectedPresetIds.join(", ")}`);
  }

  if (current.preferredColors.length > 0) {
    parts.push(`Color direction: ${current.preferredColors.join(", ")}`);
  }

  if (current.maintenancePreference !== "flexible") {
    parts.push(`Maintenance: ${current.maintenancePreference}`);
  }

  if (current.recentNotes.length > 0) {
    parts.push(`Recent notes: ${current.recentNotes.slice(-2).join(" ")}`);
  }

  return parts.join(" | ").trim();
}

function openPortraitDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve<null>(null);
  }

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(PORTRAIT_DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PORTRAIT_STORE_NAME)) {
        database.createObjectStore(PORTRAIT_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("Unable to open HairMatch portrait database:", request.error);
      resolve(null);
    };
  });
}

export async function loadPersistedPortraitAsset() {
  const database = await openPortraitDatabase();

  if (!database) {
    return null;
  }

  return await new Promise<PersistedPortraitAsset | null>((resolve) => {
    const transaction = database.transaction(PORTRAIT_STORE_NAME, "readonly");
    const store = transaction.objectStore(PORTRAIT_STORE_NAME);
    const request = store.get(ACTIVE_PORTRAIT_ASSET_ID);

    request.onsuccess = () => {
      resolve((request.result as PersistedPortraitAsset | undefined) || null);
    };
    request.onerror = () => {
      console.warn("Unable to load persisted portrait asset:", request.error);
      resolve(null);
    };

    transaction.oncomplete = () => database.close();
  });
}

export async function savePersistedPortraitAsset(asset: PersistedPortraitAsset) {
  const database = await openPortraitDatabase();

  if (!database) {
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(PORTRAIT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(PORTRAIT_STORE_NAME);
    store.put({ ...asset, id: ACTIVE_PORTRAIT_ASSET_ID });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      console.warn("Unable to persist portrait asset:", transaction.error);
      database.close();
      resolve();
    };
  });
}

export async function clearPersistedPortraitAsset() {
  const database = await openPortraitDatabase();

  if (!database) {
    return;
  }

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(PORTRAIT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(PORTRAIT_STORE_NAME);
    store.delete(ACTIVE_PORTRAIT_ASSET_ID);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      console.warn("Unable to clear portrait asset:", transaction.error);
      database.close();
      resolve();
    };
  });
}

export { ACTIVE_PORTRAIT_ASSET_ID };
