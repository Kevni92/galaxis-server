// Feature: GAL-EMPIRE-START-001
// Fachliche Grundlage: docs/docs/03-empires/reichsverwaltung.md
// Fachliche Grundlage: docs/docs/03-empires/controller-und-reichsuebernahme.md

import type { Empire, EmpireController } from "../../domain/empires/empire.js";

export interface EmpireWithController {
  readonly empire: Empire;
  readonly controller: EmpireController;
}

export interface EmpireRepository {
  /** Reiche einer Kampagne, auf die der Account Lesezugriff besitzt. */
  listReadableForAccount(
    accountId: string,
    campaignId: string,
  ): Promise<readonly EmpireWithController[]>;

  /** Ein Reich, wenn der Account es lesen darf; sonst undefined. */
  findReadableForAccount(
    accountId: string,
    empireId: string,
  ): Promise<EmpireWithController | undefined>;
}
