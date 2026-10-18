/**
 * @file guest-session.service.ts
 * @description Gestión en cliente de la membresía de usuarios no autenticados (invitados)
 * en Listas Grupales compartidas y postulaciones de candidatos.
 */

export interface GuestJoinedGroup {
  id: string;
  name: string;
  inviteCode?: string;
  guestName?: string;
  joinedAt: string;
}

export interface GuestPostulation {
  groupId: string;
  malId: number;
  title: string;
  imageUrl?: string;
  postulatedAt: string;
}

const STORAGE_KEY_GUEST_GROUPS = "animigos_guest_groups";
const STORAGE_KEY_GUEST_POSTULATIONS = "animigos_guest_postulations";

/**
 * Obtiene todas las listas grupales a las que el usuario invitado se ha unido.
 */
export function getGuestJoinedGroups(): GuestJoinedGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GUEST_GROUPS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error al leer grupos de invitado:", e);
    return [];
  }
}

/**
 * Registra al usuario invitado como participante de una lista grupal.
 */
export function addGuestJoinedGroup(group: {
  id: string;
  name: string;
  inviteCode?: string;
  guestName?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const current = getGuestJoinedGroups();
    const exists = current.some((g) => g.id === group.id);
    if (!exists) {
      const updated: GuestJoinedGroup[] = [
        ...current,
        {
          ...group,
          joinedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY_GUEST_GROUPS, JSON.stringify(updated));
      window.dispatchEvent(new Event("animigos_guest_groups_changed"));
    }
  } catch (e) {
    console.error("Error al guardar membresía de invitado:", e);
  }
}

/**
 * Elimina la membresía de un grupo para el invitado.
 */
export function removeGuestJoinedGroup(groupId: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getGuestJoinedGroups();
    const updated = current.filter((g) => g.id !== groupId);
    localStorage.setItem(STORAGE_KEY_GUEST_GROUPS, JSON.stringify(updated));
    window.dispatchEvent(new Event("animigos_guest_groups_changed"));
  } catch (e) {
    console.error("Error al remover grupo de invitado:", e);
  }
}

/**
 * Determina si el usuario invitado es miembro de al menos una lista grupal.
 */
export function isGuestMemberOfAnyGroup(): boolean {
  return getGuestJoinedGroups().length > 0;
}

/**
 * Determina si el usuario invitado es miembro de una lista específica.
 */
export function isGuestMemberOfGroup(groupId: string): boolean {
  return getGuestJoinedGroups().some((g) => g.id === groupId);
}

/**
 * Obtiene todas las postulaciones hechas por el invitado.
 */
export function getGuestPostulations(): GuestPostulation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GUEST_POSTULATIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error al leer postulaciones de invitado:", e);
    return [];
  }
}

/**
 * Postula un anime a una lista grupal en la que el invitado participe.
 */
export function postulateAnimeToGroup(
  groupId: string,
  anime: { malId: number; title: string; imageUrl?: string }
): boolean {
  if (typeof window === "undefined") return false;
  if (!isGuestMemberOfGroup(groupId)) return false;

  try {
    const current = getGuestPostulations();
    const alreadyPostulated = current.some(
      (p) => p.groupId === groupId && p.malId === anime.malId
    );

    if (!alreadyPostulated) {
      const updated: GuestPostulation[] = [
        ...current,
        {
          groupId,
          malId: anime.malId,
          title: anime.title,
          imageUrl: anime.imageUrl,
          postulatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY_GUEST_POSTULATIONS, JSON.stringify(updated));
      window.dispatchEvent(new Event("animigos_guest_postulations_changed"));
    }
    return true;
  } catch (e) {
    console.error("Error al postular anime como invitado:", e);
    return false;
  }
}

/**
 * Determina si un anime ya fue postulado por el invitado en una lista específica.
 */
export function isAnimePostulatedInGroup(groupId: string, malId: number): boolean {
  return getGuestPostulations().some(
    (p) => p.groupId === groupId && p.malId === malId
  );
}

/**
 * Determina si un anime ya fue postulado en alguna de las listas grupales del invitado.
 */
export function isAnimePostulatedInAnyGuestGroup(malId: number): boolean {
  return getGuestPostulations().some((p) => p.malId === malId);
}
