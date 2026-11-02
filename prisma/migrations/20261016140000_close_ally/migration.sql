-- Neuer Allianz-Typ „Enge Bündnispartner“ (darf sich registrieren und muss sich verifizieren).
ALTER TYPE "AllianceRelation" ADD VALUE IF NOT EXISTS 'CLOSE_ALLY';
-- Unverifizierte Gäste sind komplett gesperrt (nur Verifizierungsseite): keine Rechte mehr für die Rolle GUEST.
DELETE FROM "RolePermission" WHERE "role" = 'GUEST';
