const storageKey = "tasitGorevProgrami.records.v1";
const definitionStorageKey = "tasitGorevProgrami.definitions.v1";
const fuelStorageKey = "tasitGorevProgrami.fuelRecords.v1";
const apiStateUrl = "/api/state";
const localNetworkOrigin = "http://127.0.0.1:8080";
const institutionName = "Göksun Sosyal Yardımlaşma ve Dayanışma Vakfı";
const defaultTaskName = "Hane Ziyareti";

const defaultPeople = [
  { id: "p37", name: "ABDURRAHMAN GÜRBÜZ", title: "Sosyal Yardım İnceleme Görevlisi" },
  { id: "p42", name: "ÇAĞLAR ANTÜRK", title: "Sosyal Yardım İnceleme Görevlisi" },
  { id: "p53", name: "ÖZGE BOSTAN", title: "Personel" },
  { id: "p61", name: "AYŞE KARA", title: "Ziraat Mühendisi" },
  { id: "p62", name: "MUSTAFA YILMAZ", title: "Tekniker" },
  { id: "p63", name: "ELİF DEMİR", title: "Veteriner Hekim" }
];

const defaultApprovers = [
  { id: "a6", name: "MEHMET BAŞAR SATICI", title: "Vakıf Müdürü" },
  { id: "a8", name: "HASAN YILDIRIM", title: "İlçe Müdürü" },
  { id: "a9", name: "FATMA ERDOĞAN", title: "Müdür Yardımcısı" }
];

const defaultDrivers = [
  { id: "d1", name: "MAHMUT KIRAÇ", title: "Sürücü" },
  { id: "d2", name: "AHMET ŞAHİN", title: "Sürücü" },
  { id: "d3", name: "MURAT ÇELİK", title: "Sürücü" }
];

const defaultVehicles = [
  { id: "v1", plate: "06 EMP 149", brand: "Ford Transit", currentKm: 2276 },
  { id: "v2", plate: "46 GSN 101", brand: "Renault Kangoo", currentKm: 18420 },
  { id: "v3", plate: "46 TAR 046", brand: "Fiat Egea", currentKm: 32110 },
  { id: "v4", plate: "46 ORN 190", brand: "Toyota Hilux", currentKm: 41270 }
];

let people = defaultPeople.map((item) => ({ ...item }));
let approvers = defaultApprovers.map((item) => ({ ...item }));
let drivers = defaultDrivers.map((item) => ({ ...item }));
let vehicles = defaultVehicles.map((item) => ({ ...item }));

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık"
];

const form = document.querySelector("#missionForm");
const refs = {
  recordLabel: document.querySelector("#recordLabel"),
  institution: document.querySelector("#institution"),
  unitResponsibleId: document.querySelector("#unitResponsibleId"),
  requesterId: document.querySelector("#requesterId"),
  approverId: document.querySelector("#approverId"),
  driverId: document.querySelector("#driverId"),
  vehicleId: document.querySelector("#vehicleId"),
  outKm: document.querySelector("#outKm"),
  returnKm: document.querySelector("#returnKm"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  missionType: document.querySelector("#missionType"),
  taskName: document.querySelector("#taskName"),
  destination: document.querySelector("#destination"),
  notes: document.querySelector("#notes"),
  passengerPicker: document.querySelector("#passengerPicker"),
  addPassengerBtn: document.querySelector("#addPassengerBtn"),
  passengerRows: document.querySelector("#passengerRows"),
  recordRows: document.querySelector("#recordRows"),
  pendingReturnRows: document.querySelector("#pendingReturnRows"),
  monthFilter: document.querySelector("#monthFilter"),
  yearFilter: document.querySelector("#yearFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  ledgerVehicleFilter: document.querySelector("#ledgerVehicleFilter"),
  ledgerBox: document.querySelector("#ledgerBox"),
  ledgerCount: document.querySelector("#ledgerCount"),
  ledgerKm: document.querySelector("#ledgerKm"),
  quarterFilter: document.querySelector("#quarterFilter"),
  reportBox: document.querySelector("#reportBox"),
  personReportFilter: document.querySelector("#personReportFilter"),
  personReportBox: document.querySelector("#personReportBox"),
  fuelVehicleId: document.querySelector("#fuelVehicleId"),
  fuelDriverId: document.querySelector("#fuelDriverId"),
  fuelDate: document.querySelector("#fuelDate"),
  fuelKm: document.querySelector("#fuelKm"),
  fuelLiters: document.querySelector("#fuelLiters"),
  fuelType: document.querySelector("#fuelType"),
  fuelNote: document.querySelector("#fuelNote"),
  fuelStartDate: document.querySelector("#fuelStartDate"),
  fuelEndDate: document.querySelector("#fuelEndDate"),
  fuelReportCaption: document.querySelector("#fuelReportCaption"),
  fuelRows: document.querySelector("#fuelRows"),
  fuelCount: document.querySelector("#fuelCount"),
  fuelTotalLiters: document.querySelector("#fuelTotalLiters"),
  printArea: document.querySelector("#printArea"),
  conflictBox: document.querySelector("#conflictBox"),
  noticeBox: document.querySelector("#noticeBox"),
  dataMode: document.querySelector("#dataMode"),
  unitResponsiblePreview: document.querySelector("#unitResponsiblePreview"),
  requesterPreview: document.querySelector("#requesterPreview"),
  approverPreview: document.querySelector("#approverPreview"),
  driverPreview: document.querySelector("#driverPreview"),
  summaryCount: document.querySelector("#summaryCount"),
  summaryKm: document.querySelector("#summaryKm"),
  summaryOfficial: document.querySelector("#summaryOfficial"),
  summaryPrivate: document.querySelector("#summaryPrivate"),
  definitionForm: document.querySelector("#definitionForm"),
  definitionFields: document.querySelector("#definitionFields"),
  definitionHead: document.querySelector("#definitionHead"),
  definitionRows: document.querySelector("#definitionRows"),
  definitionTabs: document.querySelector(".definition-tabs"),
  sideTabs: document.querySelector(".side-tabs")
};

let records = [];
let fuelRecords = [];
let selectedId = null;
let selectedFuelId = null;
let selectedPassengers = [];
let activeDefinitionType = "people";
let sharedMode = false;
let sharedSaveTimer = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getById(list, id) {
  return list.find((item) => item.id === id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function formatTime(value) {
  return value || "";
}

function getKm(record) {
  const outKm = Number(record.outKm || 0);
  const returnKm = Number(record.returnKm || 0);
  return returnKm > outKm ? returnKm - outKm : 0;
}

function makeRecordId() {
  const maxId = records.reduce((max, record) => Math.max(max, Number(record.id || 0)), 0);
  return String(maxId + 1);
}

function recordDateTimeValue(record) {
  return `${record.endDate || record.startDate || ""} ${record.endTime || record.startTime || "23:59"}`;
}

function getSuggestedOutKm(vehicleId, excludeRecordId = selectedId) {
  const previousRecord = records
    .filter((record) => record.vehicleId === vehicleId && record.id !== excludeRecordId && record.returnKm)
    .sort((a, b) => recordDateTimeValue(b).localeCompare(recordDateTimeValue(a)))[0];

  if (previousRecord) return previousRecord.returnKm;
  return getById(vehicles, vehicleId)?.currentKm || "";
}

function makeDefaultRecords() {
  return [
    {
      id: "1",
      institution: institutionName,
      unitResponsibleId: "p37",
      requesterId: "p42",
      approverId: "a6",
      driverId: "d1",
      vehicleId: "v1",
      outKm: "2276",
      returnKm: "2324",
      startDate: "2026-06-12",
      endDate: "2026-06-12",
      startTime: "09:00",
      endTime: "16:30",
      missionType: "Resmi Görev",
      taskName: defaultTaskName,
      destination: "Temurağa Karaahmet Çiftlik",
      passengers: ["p53"],
      notes: "İlk örnek kayıt. Üzerine yazabilir veya silebilirsiniz.",
      createdAt: new Date().toISOString()
    }
  ];
}

function saveRecords() {
  localStorage.setItem(storageKey, JSON.stringify(records));
  queueSharedSave();
}

function loadFuelRecords() {
  try {
    fuelRecords = JSON.parse(localStorage.getItem(fuelStorageKey) || "[]");
  } catch {
    fuelRecords = [];
  }

  if (!Array.isArray(fuelRecords)) fuelRecords = [];
}

function saveFuelRecords() {
  localStorage.setItem(fuelStorageKey, JSON.stringify(fuelRecords));
  queueSharedSave();
}

function copyList(list) {
  return list.map((item) => ({ ...item }));
}

function loadDefinitions() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(definitionStorageKey) || "{}");
  } catch {
    saved = {};
  }

  people = Array.isArray(saved.people) && saved.people.length ? saved.people : copyList(defaultPeople);
  approvers = Array.isArray(saved.approvers) && saved.approvers.length ? saved.approvers : copyList(defaultApprovers);
  drivers = Array.isArray(saved.drivers) && saved.drivers.length ? saved.drivers : copyList(defaultDrivers);
  vehicles = Array.isArray(saved.vehicles) && saved.vehicles.length ? saved.vehicles : copyList(defaultVehicles);
  saveDefinitions();
}

function saveDefinitions() {
  localStorage.setItem(
    definitionStorageKey,
    JSON.stringify({
      people,
      approvers,
      drivers,
      vehicles
    })
  );
  queueSharedSave();
}

function getCurrentState() {
  return {
    records,
    fuelRecords,
    definitions: {
      people,
      approvers,
      drivers,
      vehicles
    }
  };
}

function hasSavedState(state) {
  const definitions = state?.definitions || {};
  return (
    (Array.isArray(state?.records) && state.records.length > 0) ||
    (Array.isArray(state?.fuelRecords) && state.fuelRecords.length > 0) ||
    (Array.isArray(definitions.people) && definitions.people.length > 0) ||
    (Array.isArray(definitions.approvers) && definitions.approvers.length > 0) ||
    (Array.isArray(definitions.drivers) && definitions.drivers.length > 0) ||
    (Array.isArray(definitions.vehicles) && definitions.vehicles.length > 0)
  );
}

function readLocalState() {
  let localRecords = [];
  let localFuelRecords = [];
  let localDefinitions = {};

  try {
    localRecords = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    localRecords = [];
  }

  try {
    localDefinitions = JSON.parse(localStorage.getItem(definitionStorageKey) || "{}");
  } catch {
    localDefinitions = {};
  }

  try {
    localFuelRecords = JSON.parse(localStorage.getItem(fuelStorageKey) || "[]");
  } catch {
    localFuelRecords = [];
  }

  return {
    records: Array.isArray(localRecords) ? localRecords : [],
    fuelRecords: Array.isArray(localFuelRecords) ? localFuelRecords : [],
    definitions: localDefinitions && typeof localDefinitions === "object" ? localDefinitions : {}
  };
}

function applyState(state) {
  const definitions = state?.definitions || {};
  people = Array.isArray(definitions.people) && definitions.people.length ? definitions.people : copyList(defaultPeople);
  approvers =
    Array.isArray(definitions.approvers) && definitions.approvers.length
      ? definitions.approvers
      : copyList(defaultApprovers);
  drivers = Array.isArray(definitions.drivers) && definitions.drivers.length ? definitions.drivers : copyList(defaultDrivers);
  vehicles = Array.isArray(definitions.vehicles) && definitions.vehicles.length ? definitions.vehicles : copyList(defaultVehicles);
  records = Array.isArray(state?.records) && state.records.length ? state.records : makeDefaultRecords();
  fuelRecords = Array.isArray(state?.fuelRecords) ? state.fuelRecords : [];
}

async function loadSharedState() {
  if (location.protocol === "file:") return false;

  try {
    const response = await fetch(apiStateUrl, { cache: "no-store" });
    if (!response.ok) return false;
    let state = await response.json();
    const localState = readLocalState();
    if (!hasSavedState(state) && hasSavedState(localState)) {
      state = localState;
    }
    applyState(state);
    localStorage.setItem(storageKey, JSON.stringify(records));
    localStorage.setItem(fuelStorageKey, JSON.stringify(fuelRecords));
    localStorage.setItem(definitionStorageKey, JSON.stringify({ people, approvers, drivers, vehicles }));
    sharedMode = true;
    refs.dataMode.textContent = "Ortak ağ verisi ile çalışıyor";
    await saveSharedStateNow();
    return true;
  } catch {
    return false;
  }
}

async function redirectFilePageToNetwork() {
  if (location.protocol !== "file:") return false;

  try {
    const response = await fetch(`${localNetworkOrigin}/api/health`, { cache: "no-store" });
    if (!response.ok) return false;
    location.replace(localNetworkOrigin);
    return true;
  } catch {
    return false;
  }
}

function queueSharedSave() {
  if (!sharedMode) return;
  window.clearTimeout(sharedSaveTimer);
  sharedSaveTimer = window.setTimeout(() => {
    saveSharedStateNow();
  }, 250);
}

function saveSharedStateOnClose() {
  if (!sharedMode || !navigator.sendBeacon) return;
  const body = new Blob([JSON.stringify(getCurrentState())], { type: "application/json" });
  navigator.sendBeacon(apiStateUrl, body);
}

async function saveSharedStateNow() {
  if (!sharedMode) return false;

  try {
    const response = await fetch(apiStateUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getCurrentState())
    });
    if (!response.ok) throw new Error("save failed");
    refs.dataMode.textContent = "Ortak ağ verisi kaydedildi";
    return true;
  } catch {
    refs.dataMode.textContent = "Ortak veri bağlantısı yok; bu ekrandaki değişiklik kaydedilemedi";
    showConflict(["Ana bilgisayardaki veri sunucusuna ulaşılamadı."]);
    return false;
  }
}

const definitionConfig = {
  people: {
    label: "Personel",
    addLabel: "Personel Ekle",
    list: () => people,
    prefix: "p",
    usedBy: (record, id) => record.passengers?.includes(id)
  },
  approvers: {
    label: "Görevlendiren Amir",
    addLabel: "Amir Ekle",
    list: () => approvers,
    prefix: "a",
    usedBy: (record, id) => record.approverId === id
  },
  drivers: {
    label: "Sürücü",
    addLabel: "Sürücü Ekle",
    list: () => drivers,
    prefix: "d",
    usedBy: (record, id) => record.driverId === id
  },
  vehicles: {
    label: "Araç",
    addLabel: "Araç Ekle",
    list: () => vehicles,
    prefix: "v",
    usedBy: (record, id) => record.vehicleId === id
  }
};

function getDefinitionList(type = activeDefinitionType) {
  return definitionConfig[type].list();
}

function makeDefinitionId(type) {
  const config = definitionConfig[type];
  const maxId = getDefinitionList(type).reduce((max, item) => {
    const numeric = Number(String(item.id).replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `${config.prefix}${maxId + 1}`;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function resolveId(list, preferredId) {
  if (list.some((item) => item.id === preferredId)) return preferredId;
  return list[0]?.id || "";
}

function isDefinitionUsed(type, id) {
  return records.some((record) => definitionConfig[type].usedBy(record, id));
}

function loadRecords() {
  try {
    records = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    records = [];
  }

  if (!records.length) {
    records = makeDefaultRecords();
    saveRecords();
  }
}

function fillSelect(select, list, labelFn) {
  select.innerHTML = list
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(labelFn(item))}</option>`)
    .join("");
}

function refreshSelectOptions() {
  const previous = {
    unitResponsibleId: refs.unitResponsibleId.value,
    requesterId: refs.requesterId.value,
    approverId: refs.approverId.value,
    driverId: refs.driverId.value,
    vehicleId: refs.vehicleId.value,
    ledgerVehicleFilter: refs.ledgerVehicleFilter.value,
    personReportFilter: refs.personReportFilter.value,
    fuelVehicleId: refs.fuelVehicleId.value,
    fuelDriverId: refs.fuelDriverId.value,
    passengerPicker: refs.passengerPicker.value
  };

  fillSelect(refs.unitResponsibleId, people, (person) => `${person.name}`);
  fillSelect(refs.requesterId, people, (person) => `${person.name}`);
  fillSelect(refs.passengerPicker, people, (person) => `${person.name} - ${person.title}`);
  fillSelect(refs.approverId, approvers, (person) => `${person.name}`);
  fillSelect(refs.driverId, drivers, (driver) => `${driver.name}`);
  fillSelect(refs.vehicleId, vehicles, (vehicle) => `${vehicle.plate} - ${vehicle.brand}`);
  fillSelect(refs.ledgerVehicleFilter, vehicles, (vehicle) => `${vehicle.plate} - ${vehicle.brand}`);
  fillSelect(refs.personReportFilter, people, (person) => `${person.name} - ${person.title}`);
  fillSelect(refs.fuelVehicleId, vehicles, (vehicle) => `${vehicle.plate} - ${vehicle.brand}`);
  fillSelect(refs.fuelDriverId, drivers, (driver) => driver.name);

  refs.unitResponsibleId.value = resolveId(people, previous.unitResponsibleId);
  refs.requesterId.value = resolveId(people, previous.requesterId);
  refs.approverId.value = resolveId(approvers, previous.approverId);
  refs.driverId.value = resolveId(drivers, previous.driverId);
  refs.vehicleId.value = resolveId(vehicles, previous.vehicleId);
  refs.ledgerVehicleFilter.value = resolveId(vehicles, previous.ledgerVehicleFilter || previous.vehicleId);
  refs.personReportFilter.value = resolveId(people, previous.personReportFilter || previous.passengerPicker);
  refs.fuelVehicleId.value = resolveId(vehicles, previous.fuelVehicleId || previous.vehicleId);
  refs.fuelDriverId.value = resolveId(drivers, previous.fuelDriverId || previous.driverId);
  refs.passengerPicker.value = resolveId(people, previous.passengerPicker);

  selectedPassengers = selectedPassengers.filter((personId) => people.some((person) => person.id === personId));
  updatePreviews();
  renderPassengers();
  updateConflictBox();
  renderRecords();
  renderReport();
  renderPersonReport();
  renderVehicleLedger();
  renderFuelRecords();
}

function fillFilters() {
  refs.monthFilter.innerHTML = monthNames
    .map((name, index) => `<option value="${index + 1}">${name}</option>`)
    .join("");

  const now = new Date();
  refs.monthFilter.value = String(now.getMonth() + 1);
  refs.yearFilter.value = String(now.getFullYear());
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  refs.quarterFilter.value = String(quarter);
}

function previewPerson(container, item) {
  container.innerHTML = item
    ? `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.title)}</span>`
    : "";
}

function updatePreviews() {
  previewPerson(refs.unitResponsiblePreview, getById(people, refs.unitResponsibleId.value));
  previewPerson(refs.requesterPreview, getById(people, refs.requesterId.value));
  previewPerson(refs.approverPreview, getById(approvers, refs.approverId.value));
  previewPerson(refs.driverPreview, getById(drivers, refs.driverId.value));
}

function showNotice(message) {
  refs.noticeBox.textContent = message;
  refs.noticeBox.classList.add("show");
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => refs.noticeBox.classList.remove("show"), 2600);
}

function showConflict(messages) {
  if (!messages.length) {
    refs.conflictBox.classList.remove("show");
    refs.conflictBox.innerHTML = "";
    return;
  }

  refs.conflictBox.innerHTML = messages.map((message) => `<div>${escapeHtml(message)}</div>`).join("");
  refs.conflictBox.classList.add("show");
}

function requireSharedWrite() {
  if (sharedMode) return true;
  showConflict(["Kayıt işlemi için programı yerel ağ adresinden açın. Ana bilgisayarda baslat-ag-sunucusu.bat çalışmalı ve adres http://...:8080 olmalıdır."]);
  return false;
}

function getFormRecord() {
  return {
    id: selectedId || makeRecordId(),
    institution: refs.institution.value.trim(),
    unitResponsibleId: refs.unitResponsibleId.value,
    requesterId: refs.requesterId.value,
    approverId: refs.approverId.value,
    driverId: refs.driverId.value,
    vehicleId: refs.vehicleId.value,
    outKm: refs.outKm.value,
    returnKm: refs.returnKm.value,
    startDate: refs.startDate.value,
    endDate: refs.startDate.value,
    startTime: refs.startTime.value,
    endTime: refs.endTime.value,
    missionType: refs.missionType.value,
    taskName: refs.taskName.value.trim(),
    destination: refs.destination.value.trim(),
    passengers: [...selectedPassengers],
    notes: refs.notes.value.trim(),
    createdAt: selectedId ? records.find((record) => record.id === selectedId)?.createdAt : new Date().toISOString()
  };
}

function setForm(record) {
  selectedId = record?.id || null;
  selectedPassengers = record?.passengers ? [...record.passengers] : [];

  refs.recordLabel.textContent = selectedId ? `Kayıt No: ${selectedId}` : "Yeni kayıt";
  refs.institution.value = record?.institution || institutionName;
  refs.unitResponsibleId.value = resolveId(people, record?.unitResponsibleId || people[0]?.id);
  refs.requesterId.value = resolveId(people, record?.requesterId || people[1]?.id || people[0]?.id);
  refs.approverId.value = resolveId(approvers, record?.approverId || approvers[0]?.id);
  refs.driverId.value = resolveId(drivers, record?.driverId || drivers[0]?.id);
  refs.vehicleId.value = resolveId(vehicles, record?.vehicleId || vehicles[0]?.id);
  refs.outKm.value = record?.outKm || getSuggestedOutKm(refs.vehicleId.value, record?.id);
  refs.returnKm.value = record?.returnKm || "";
  refs.startDate.value = record?.startDate || today();
  refs.endDate.value = record?.endDate || refs.startDate.value;
  refs.startTime.value = record?.startTime || "09:00";
  refs.endTime.value = record?.endTime || "";
  refs.missionType.value = record?.missionType || "Resmi Görev";
  refs.taskName.value = record?.taskName || defaultTaskName;
  refs.destination.value = record?.destination || "";
  refs.notes.value = record?.notes || "";

  updatePreviews();
  renderPassengers();
  updateConflictBox();
  renderRecords();
}

function renderPassengers() {
  if (!selectedPassengers.length) {
    refs.passengerRows.innerHTML = `<tr><td class="empty" colspan="3">Henüz personel eklenmedi.</td></tr>`;
    return;
  }

  refs.passengerRows.innerHTML = selectedPassengers
    .map((personId) => {
      const person = getById(people, personId);
      if (!person) return "";
      return `
        <tr>
          <td>${escapeHtml(person.name)}</td>
          <td>${escapeHtml(person.title)}</td>
          <td class="narrow"><button class="mini-btn" data-remove-passenger="${escapeHtml(person.id)}" type="button">Sil</button></td>
        </tr>
      `;
    })
    .join("");
}

function getRange(record) {
  const start = new Date(`${record.startDate}T${record.startTime || "00:00"}`);
  const end = new Date(`${record.endDate || record.startDate}T${record.endTime || "23:59"}`);
  return {
    start,
    end: end < start ? start : end
  };
}

function overlaps(a, b) {
  const rangeA = getRange(a);
  const rangeB = getRange(b);
  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
}

function findConflicts(candidate) {
  if (!candidate.startDate || !candidate.endDate || !candidate.startTime) return [];

  const messages = [];
  records.forEach((record) => {
    if (record.id === candidate.id) return;
    if (!overlaps(candidate, record)) return;

    const vehicle = getById(vehicles, record.vehicleId);
    const driver = getById(drivers, record.driverId);
    const dateText = `${formatDate(record.startDate)} ${formatTime(record.startTime)}-${formatTime(record.endTime) || "dönüş saati boş"}`;

    if (record.vehicleId === candidate.vehicleId) {
      messages.push(`${vehicle?.plate || "Araç"} aynı saatlerde başka görevde: ${record.taskName} (${dateText}).`);
    }

    if (record.driverId === candidate.driverId) {
      messages.push(`${driver?.name || "Sürücü"} aynı saatlerde başka görevde: ${record.taskName} (${dateText}).`);
    }
  });

  return messages;
}

function updateConflictBox() {
  showConflict(findConflicts(getFormRecord()));
}

function validateRecord(record) {
  const required = [
    [record.institution, "Kurum adı"],
    [record.taskName, "Görevin türü"],
    [record.destination, "Gidilecek yer"],
    [record.startDate, "Çıkış tarihi"],
    [record.endDate, "Dönüş tarihi"],
    [record.startTime, "Çıkış saati"]
  ];

  const missing = required.find(([value]) => !value);
  if (missing) {
    showConflict([`${missing[1]} alanı boş bırakılamaz.`]);
    return false;
  }

  const outKm = Number(record.outKm || 0);
  const returnKm = Number(record.returnKm || 0);
  if (returnKm && outKm && returnKm < outKm) {
    showConflict(["Dönüş KM'si çıkış KM'sinden küçük olamaz."]);
    return false;
  }

  const conflicts = findConflicts(record);
  if (conflicts.length) {
    showConflict(conflicts);
    return false;
  }

  return true;
}

async function saveCurrentRecord() {
  if (!requireSharedWrite()) return;
  const record = getFormRecord();
  if (!validateRecord(record)) return;

  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  selectedId = record.id;
  saveRecords();
  const sharedSaved = sharedMode ? await saveSharedStateNow() : false;
  renderRecords();
  renderReport();
  renderPersonReport();
  renderVehicleLedger();
  setForm(record);
  showNotice(
    sharedMode
      ? sharedSaved
        ? "Kayıt ortak ağ dosyasına kaydedildi."
        : "Kayıt bu ekranda kaldı; ortak ağ dosyasına yazılamadı."
      : "Kayıt bu bilgisayarın tarayıcısına kaydedildi."
  );
}

async function deleteCurrentRecord() {
  if (!requireSharedWrite()) return;
  if (!selectedId) {
    showNotice("Silinecek kayıt seçili değil.");
    return;
  }

  const record = records.find((item) => item.id === selectedId);
  const label = record ? `${formatDate(record.startDate)} tarihli ${record.taskName}` : "seçili kayıt";
  if (!window.confirm(`${label} silinsin mi?`)) return;

  records = records.filter((item) => item.id !== selectedId);
  saveRecords();
  const sharedSaved = sharedMode ? await saveSharedStateNow() : false;
  setForm(null);
  renderReport();
  renderPersonReport();
  renderVehicleLedger();
  showNotice(
    sharedMode
      ? sharedSaved
        ? "Kayıt ortak ağ dosyasından silindi."
        : "Kayıt bu ekranda silindi; ortak ağ dosyasına yazılamadı."
      : "Kayıt bu bilgisayarın tarayıcısından silindi."
  );
}

function filteredRecords() {
  const month = Number(refs.monthFilter.value);
  const year = Number(refs.yearFilter.value);
  const search = refs.searchFilter.value.trim().toLocaleLowerCase("tr-TR");

  return records
    .filter((record) => {
      const date = new Date(`${record.startDate}T00:00`);
      if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return false;

      if (!search) return true;

      const vehicle = getById(vehicles, record.vehicleId);
      const driver = getById(drivers, record.driverId);
      const haystack = [
        vehicle?.plate,
        driver?.name,
        record.taskName,
        record.destination,
        record.missionType
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(search);
    })
    .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
}

function renderRecords() {
  const visible = filteredRecords();

  if (!visible.length) {
    refs.recordRows.innerHTML = `<tr><td class="empty" colspan="4">Bu filtreye uygun kayıt yok.</td></tr>`;
  } else {
    refs.recordRows.innerHTML = visible
      .map((record) => {
        const vehicle = getById(vehicles, record.vehicleId);
        const driver = getById(drivers, record.driverId);
        const active = record.id === selectedId ? " class=\"active\"" : "";
        return `
          <tr${active} data-record-id="${escapeHtml(record.id)}">
            <td>${formatDate(record.startDate)}<br>${formatTime(record.startTime)}</td>
            <td>${escapeHtml(vehicle?.plate || "")}</td>
            <td>${escapeHtml(driver?.name || "")}</td>
            <td>${escapeHtml(record.taskName)}<br><span class="muted">${escapeHtml(record.destination)}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  const officialCount = visible.filter((record) => record.missionType === "Resmi Görev").length;
  refs.summaryCount.textContent = String(visible.length);
  refs.summaryKm.textContent = String(visible.reduce((sum, record) => sum + getKm(record), 0));
  refs.summaryOfficial.textContent = String(officialCount);
  refs.summaryPrivate.textContent = String(visible.length - officialCount);
  renderPendingReturns();
}

function pendingReturnRecords() {
  return filteredRecords().filter((record) => !record.endTime || !record.returnKm);
}

function renderPendingReturns() {
  const pending = pendingReturnRecords();

  if (!pending.length) {
    refs.pendingReturnRows.innerHTML = `<tr><td class="empty" colspan="4">Dönüş bilgisi bekleyen kayıt yok.</td></tr>`;
    return;
  }

  refs.pendingReturnRows.innerHTML = pending
    .map((record) => {
      const vehicle = getById(vehicles, record.vehicleId);
      return `
        <tr>
          <td>${formatDate(record.startDate)}<br>${formatTime(record.startTime)}</td>
          <td>${escapeHtml(vehicle?.plate || "")}</td>
          <td>${escapeHtml(record.taskName)}<br><span class="muted">${escapeHtml(record.destination)}</span></td>
          <td class="narrow"><button class="mini-btn" data-edit-return="${escapeHtml(record.id)}" type="button">Dönüş Gir</button></td>
        </tr>
      `;
    })
    .join("");
}

function editReturnInfo(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;

  setForm(record);
  refs.returnKm.focus();
  refs.returnKm.select();
  showNotice("Dönüş KM ve dönüş saati alanlarını doldurup Kaydet'e basın.");
}

function groupByVehicle(recordsToGroup) {
  const map = new Map();
  recordsToGroup.forEach((record) => {
    const vehicle = getById(vehicles, record.vehicleId);
    const key = vehicle?.plate || "Bilinmeyen Araç";
    const current = map.get(key) || { plate: key, count: 0, km: 0 };
    current.count += 1;
    current.km += getKm(record);
    map.set(key, current);
  });
  return [...map.values()];
}

function quarterRecords() {
  const year = Number(refs.yearFilter.value);
  const quarter = Number(refs.quarterFilter.value);
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  return records.filter((record) => {
    const date = new Date(`${record.startDate}T00:00`);
    return date.getFullYear() === year && date.getMonth() >= startMonth && date.getMonth() <= endMonth;
  });
}

function renderReport() {
  const monthly = filteredRecords();
  const quarterly = quarterRecords();
  const vehicleSummary = groupByVehicle(monthly);
  const quarterSummary = groupByVehicle(quarterly);
  const monthName = monthNames[Number(refs.monthFilter.value) - 1];

  refs.reportBox.innerHTML = `
    <div class="report-block">
      <h3>${escapeHtml(monthName)} ${escapeHtml(refs.yearFilter.value)} Araç Özeti</h3>
      ${renderSummaryTable(vehicleSummary)}
    </div>
    <div class="report-block">
      <h3>${escapeHtml(refs.quarterFilter.value)}. Çeyrek Dönem Raporu</h3>
      ${renderSummaryTable(quarterSummary)}
    </div>
  `;
}

function renderSummaryTable(rows) {
  if (!rows.length) return `<div class="empty">Raporlanacak kayıt yok.</div>`;

  return `
    <div class="table-wrap compact">
      <table>
        <thead>
          <tr>
            <th>Plaka</th>
            <th>Görev</th>
            <th>KM</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.plate)}</td>
                  <td>${row.count}</td>
                  <td>${row.km}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function personMissionRecords(personId = refs.personReportFilter.value) {
  const month = Number(refs.monthFilter.value);
  const year = Number(refs.yearFilter.value);

  return records
    .filter((record) => {
      const date = new Date(`${record.startDate}T00:00`);
      return (
        date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        Array.isArray(record.passengers) &&
        record.passengers.includes(personId)
      );
    })
    .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
}

function renderPersonReport() {
  if (!refs.personReportFilter.value && people[0]) {
    refs.personReportFilter.value = people[0].id;
  }

  const rows = personMissionRecords();

  if (!rows.length) {
    refs.personReportBox.innerHTML = `<div class="empty">Seçili personel için bu ay görev kaydı yok.</div>`;
    return;
  }

  refs.personReportBox.innerHTML = `
    <div class="table-wrap person-report-preview">
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Araç</th>
            <th>Şoför</th>
            <th>Görev</th>
            <th>Yer</th>
            <th>Saat</th>
            <th>KM</th>
          </tr>
        </thead>
        <tbody>${renderPersonMissionRows(rows)}</tbody>
      </table>
    </div>
  `;
}

function renderPersonMissionRows(rows) {
  return rows
    .map((record) => {
      const vehicle = getById(vehicles, record.vehicleId);
      const driver = getById(drivers, record.driverId);
      return `
        <tr>
          <td>${formatDate(record.startDate)}</td>
          <td>${escapeHtml(vehicle?.plate || "")}</td>
          <td>${escapeHtml(driver?.name || "")}</td>
          <td>${escapeHtml(record.taskName || "")}</td>
          <td>${escapeHtml(record.destination || "")}</td>
          <td>${escapeHtml(record.startTime || "")} - ${escapeHtml(record.endTime || "")}</td>
          <td>${getKm(record)}</td>
        </tr>
      `;
    })
    .join("");
}

function makeFuelRecordId() {
  const maxId = fuelRecords.reduce((max, record) => {
    const numeric = Number(String(record.id || "").replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return `f${maxId + 1}`;
}

function fuelRecordsForVehicle(vehicleId = refs.fuelVehicleId.value) {
  return fuelRecords
    .filter((record) => record.vehicleId === vehicleId)
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.km) - Number(b.km));
}

function firstDayOfMonth(value = today()) {
  return `${value.slice(0, 7)}-01`;
}

function filteredFuelRecords() {
  const startDate = refs.fuelStartDate.value;
  const endDate = refs.fuelEndDate.value;
  return fuelRecordsForVehicle().filter((record) => {
    if (startDate && record.date < startDate) return false;
    if (endDate && record.date > endDate) return false;
    return true;
  });
}

function getSuggestedFuelKm(vehicleId) {
  const latestFuel = fuelRecordsForVehicle(vehicleId).at(-1);
  if (latestFuel?.km) return latestFuel.km;
  return getSuggestedOutKm(vehicleId, null);
}

function setFuelForm(record) {
  selectedFuelId = record?.id || null;
  refs.fuelVehicleId.value = resolveId(vehicles, record?.vehicleId || refs.fuelVehicleId.value || vehicles[0]?.id);
  refs.fuelDriverId.value = resolveId(drivers, record?.driverId || refs.fuelDriverId.value || drivers[0]?.id);
  refs.fuelDate.value = record?.date || today();
  refs.fuelKm.value = record?.km || getSuggestedFuelKm(refs.fuelVehicleId.value);
  refs.fuelLiters.value = record?.liters || "";
  refs.fuelType.value = record?.fuelType || "Motorin";
  refs.fuelNote.value = record?.note || "";
  renderFuelRecords();
}

function getFuelFormRecord() {
  return {
    id: selectedFuelId || makeFuelRecordId(),
    vehicleId: refs.fuelVehicleId.value,
    driverId: refs.fuelDriverId.value,
    date: refs.fuelDate.value,
    km: refs.fuelKm.value,
    liters: refs.fuelLiters.value,
    fuelType: refs.fuelType.value,
    note: refs.fuelNote.value.trim(),
    createdAt: selectedFuelId
      ? fuelRecords.find((record) => record.id === selectedFuelId)?.createdAt
      : new Date().toISOString()
  };
}

function validateFuelRecord(candidate) {
  if (!candidate.vehicleId || !candidate.driverId || !candidate.date || !candidate.km || !candidate.liters) {
    showConflict(["Araç, yakıtı alan şoför, yakıt tarihi, araç KM'si ve alınan litre alanları zorunludur."]);
    return false;
  }

  if (Number(candidate.km) < 0 || Number(candidate.liters) <= 0) {
    showConflict(["KM ve yakıt değerlerini kontrol edin."]);
    return false;
  }

  const ordered = [
    ...fuelRecords.filter((record) => record.vehicleId === candidate.vehicleId && record.id !== candidate.id),
    candidate
  ].sort((a, b) => a.date.localeCompare(b.date) || Number(a.km) - Number(b.km));
  const index = ordered.findIndex((record) => record.id === candidate.id);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];

  if (previous && Number(candidate.km) < Number(previous.km)) {
    showConflict([`Bu tarihten önceki yakıt kaydının KM'si ${previous.km}. Girilen KM daha küçük olamaz.`]);
    return false;
  }

  if (next && Number(candidate.km) > Number(next.km)) {
    showConflict([`Bu tarihten sonraki yakıt kaydının KM'si ${next.km}. Girilen KM daha büyük olamaz.`]);
    return false;
  }

  return true;
}

async function saveFuelRecord() {
  if (!requireSharedWrite()) return;
  const record = getFuelFormRecord();
  if (!validateFuelRecord(record)) return;

  const existingIndex = fuelRecords.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) fuelRecords[existingIndex] = record;
  else fuelRecords.push(record);

  const vehicle = getById(vehicles, record.vehicleId);
  if (vehicle && Number(record.km) > Number(vehicle.currentKm || 0)) {
    vehicle.currentKm = Number(record.km);
    saveDefinitions();
  }

  saveFuelRecords();
  const sharedSaved = sharedMode ? await saveSharedStateNow() : false;
  renderFuelRecords();
  setFuelForm(record);
  showNotice(
    sharedMode
      ? sharedSaved
        ? "Yakıt kaydı ortak ağ dosyasına kaydedildi."
        : "Yakıt kaydı bu ekranda kaldı; ortak ağ dosyasına yazılamadı."
      : "Yakıt kaydı bu bilgisayarın tarayıcısına kaydedildi."
  );
}

async function deleteFuelRecord(recordId) {
  if (!requireSharedWrite()) return;
  const record = fuelRecords.find((item) => item.id === recordId);
  if (!record) return;
  if (!window.confirm(`${formatDate(record.date)} tarihli yakıt kaydı silinsin mi?`)) return;

  fuelRecords = fuelRecords.filter((item) => item.id !== recordId);
  saveFuelRecords();
  const sharedSaved = sharedMode ? await saveSharedStateNow() : false;
  setFuelForm(null);
  showNotice(
    sharedMode
      ? sharedSaved
        ? "Yakıt kaydı ortak ağ dosyasından silindi."
        : "Yakıt kaydı bu ekranda silindi; ortak ağ dosyasına yazılamadı."
      : "Yakıt kaydı silindi."
  );
}

function formatNumber(value, fractionDigits = 2) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

function renderFuelRecords() {
  if (!refs.fuelVehicleId.value && vehicles[0]) refs.fuelVehicleId.value = vehicles[0].id;
  const vehicle = getById(vehicles, refs.fuelVehicleId.value);
  const allRows = fuelRecordsForVehicle();
  const rows = filteredFuelRecords();
  refs.fuelReportCaption.textContent = `${vehicle?.plate || ""} | ${formatDate(refs.fuelStartDate.value)} - ${formatDate(refs.fuelEndDate.value)}`;
  refs.fuelCount.textContent = String(rows.length);
  refs.fuelTotalLiters.textContent = formatNumber(rows.reduce((sum, record) => sum + Number(record.liters || 0), 0));

  if (!rows.length) {
    refs.fuelRows.innerHTML = `<tr><td class="empty" colspan="6">Seçili araç ve tarih aralığı için yakıt kaydı yok.</td></tr>`;
    return;
  }

  refs.fuelRows.innerHTML = rows
    .map((record) => {
      const allIndex = allRows.findIndex((item) => item.id === record.id);
      const next = allRows[allIndex + 1];
      const distance = next ? Number(next.km) - Number(record.km) : null;
      const driver = getById(drivers, record.driverId);
      return `
        <tr class="${record.id === selectedFuelId ? "active" : ""}">
          <td>${formatDate(record.date)}</td>
          <td>${escapeHtml(driver?.name || "-")}</td>
          <td>${escapeHtml(record.km)}</td>
          <td>${formatNumber(record.liters)}</td>
          <td>${distance === null ? "Bekliyor" : distance >= 0 ? `${distance} KM` : "KM sırası hatalı"}</td>
          <td class="fuel-actions">
            <button class="mini-btn" data-edit-fuel="${escapeHtml(record.id)}" type="button">Düzenle</button>
            <button class="mini-btn delete" data-delete-fuel="${escapeHtml(record.id)}" type="button">Sil</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function printFuelReport() {
  const vehicle = getById(vehicles, refs.fuelVehicleId.value);
  const allRows = fuelRecordsForVehicle();
  const rows = filteredFuelRecords();
  const totalLiters = rows.reduce((sum, record) => sum + Number(record.liters || 0), 0);

  const tableRows = rows
    .map((record) => {
      const driver = getById(drivers, record.driverId);
      const allIndex = allRows.findIndex((item) => item.id === record.id);
      const next = allRows[allIndex + 1];
      const distance = next ? Number(next.km) - Number(record.km) : null;
      return `
        <tr>
          <td>${formatDate(record.date)}</td>
          <td>${escapeHtml(driver?.name || "-")}</td>
          <td>${escapeHtml(record.fuelType || "-")}</td>
          <td>${escapeHtml(record.km)}</td>
          <td>${formatNumber(record.liters)}</td>
          <td>${next ? formatDate(next.date) : "-"}</td>
          <td>${next ? escapeHtml(next.km) : "-"}</td>
          <td>${distance === null ? "Bekliyor" : `${distance} KM`}</td>
          <td>${escapeHtml(record.note || "")}</td>
        </tr>
      `;
    })
    .join("");

  printWithHtml(`
    <style>
      @page {
        size: A4 landscape;
        margin: 9mm;
      }
    </style>
    <article class="print-document fuel-report-print">
      <h1>ARAÇ BAZLI YAKIT ALIM RAPORU</h1>
      <div class="print-meta">
        <span>Araç: ${escapeHtml(vehicle?.plate || "")} ${vehicle?.brand ? `- ${escapeHtml(vehicle.brand)}` : ""}</span>
        <span>Tarih: ${formatDate(refs.fuelStartDate.value)} - ${formatDate(refs.fuelEndDate.value)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Yakıt Tarihi</th>
            <th>Yakıtı Alan Şoför</th>
            <th>Yakıt Türü</th>
            <th>Araç KM</th>
            <th>Litre</th>
            <th>Sonraki Alım</th>
            <th>Sonraki KM</th>
            <th>Gidilen KM</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="9">Kayıt yok.</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOPLAM</td>
            <td>${formatNumber(totalLiters)} L</td>
            <td colspan="4">Kayıt sayısı: ${rows.length}</td>
          </tr>
        </tfoot>
      </table>
    </article>
  `);
}

function vehicleLedgerRecords(vehicleId = refs.ledgerVehicleFilter.value) {
  const month = Number(refs.monthFilter.value);
  const year = Number(refs.yearFilter.value);

  return records
    .filter((record) => {
      if (record.vehicleId !== vehicleId) return false;
      const date = new Date(`${record.startDate}T00:00`);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    })
    .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
}

function renderVehicleLedger() {
  if (!refs.ledgerVehicleFilter.value && vehicles[0]) {
    refs.ledgerVehicleFilter.value = vehicles[0].id;
  }

  const ledgerRecords = vehicleLedgerRecords();
  const totalKm = ledgerRecords.reduce((sum, record) => sum + getKm(record), 0);
  refs.ledgerCount.textContent = String(ledgerRecords.length);
  refs.ledgerKm.textContent = String(totalKm);

  if (!ledgerRecords.length) {
    refs.ledgerBox.innerHTML = `<div class="empty">Seçili araç için bu ay kayıt yok.</div>`;
    return;
  }

  refs.ledgerBox.innerHTML = `
    <div class="table-wrap ledger-preview">
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Şoför</th>
            <th>Plaka</th>
            <th>Çıkış</th>
            <th>Çıkış KM</th>
            <th>Dönüş</th>
            <th>Dönüş KM</th>
            <th>Gittiği Yer</th>
            <th>Görevi</th>
            <th>İmza</th>
          </tr>
        </thead>
        <tbody>${renderVehicleLedgerRows(ledgerRecords, false)}</tbody>
      </table>
    </div>
  `;
}

function renderVehicleLedgerRows(ledgerRecords, includeEmptyRows) {
  const rows = ledgerRecords.map((record) => {
    const vehicle = getById(vehicles, record.vehicleId);
    const driver = getById(drivers, record.driverId);
    return `
      <tr>
        <td>${formatDate(record.startDate)}</td>
        <td>${escapeHtml(driver?.name || "")}</td>
        <td>${escapeHtml(vehicle?.plate || "")}</td>
        <td>${escapeHtml(record.startTime || "")}</td>
        <td>${escapeHtml(record.outKm || "")}</td>
        <td>${escapeHtml(record.endTime || "")}</td>
        <td>${escapeHtml(record.returnKm || "")}</td>
        <td>${escapeHtml(record.destination || "")}</td>
        <td>${escapeHtml(record.taskName || "")}</td>
        <td></td>
      </tr>
    `;
  });

  if (includeEmptyRows) {
    const emptyCount = Math.max(0, 20 - rows.length);
    for (let index = 0; index < emptyCount; index += 1) {
      rows.push(`
        <tr>
          <td></td><td></td><td></td><td></td><td></td>
          <td></td><td></td><td></td><td></td><td></td>
        </tr>
      `);
    }
  }

  return rows.join("");
}

function personNames(ids) {
  return ids
    .map((id) => getById(people, id))
    .filter(Boolean)
    .map((person) => `${person.name} - ${person.title}`);
}

function printWithHtml(html) {
  refs.printArea.innerHTML = html;
  document.body.classList.add("printing");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("printing");
    refs.printArea.innerHTML = "";
  }, 500);
}

function printCurrentMission() {
  const record = getFormRecord();
  if (!validateRecord(record)) return;

  const vehicle = getById(vehicles, record.vehicleId);
  const approver = getById(approvers, record.approverId);
  const driver = getById(drivers, record.driverId);
  const passengers = record.passengers
    .map((id) => getById(people, id))
    .filter(Boolean);
  const passengerRows = Array.from({ length: 4 }, (_, index) => {
    const person = passengers[index];
    return `
      <tr>
        <td class="left-cell">${index + 1}-${person ? ` ${escapeHtml(person.name)}` : ""}</td>
        <td colspan="2">${person ? escapeHtml(person.title) : ""}</td>
        ${
          index === 0
            ? `<td class="red-cell" colspan="3">Aracın Km'si</td>`
            : index === 1
              ? `<td>Çıkış Saati</td><td colspan="2">Dönüş Saati</td>`
              : index === 2
                ? `<td>${escapeHtml(record.startTime || "")}</td><td colspan="2">${escapeHtml(record.endTime || "")}</td>`
                : `<td>Çıkış Km.</td><td colspan="2">Dönüş Km.</td>`
        }
      </tr>
    `;
  }).join("");

  printWithHtml(`
    <article class="print-document mission-print">
      <table class="output-form duty-order">
        <tr>
          <td class="duty-title" colspan="4">TAŞIT GÖREV EMRİ</td>
          <td class="serial-cell" colspan="2">S.No. ${escapeHtml(record.id)}<br>${formatDate(record.startDate)}</td>
        </tr>

        <tr>
          <th colspan="3">GÖREVLENDİREN BİRİM AMİRİNİN</th>
          <th colspan="3">ARACIN</th>
        </tr>
        <tr>
          <th>Adı Soyadı</th>
          <th>Unvanı</th>
          <th>İmzası</th>
          <th>Sürücünün Adı Soyadı</th>
          <td colspan="2">${escapeHtml(driver?.name || "")}</td>
        </tr>
        <tr>
          <td>${escapeHtml(approver?.name || "")}</td>
          <td>${escapeHtml(approver?.title || "")}</td>
          <td></td>
          <th>Plakası</th>
          <td colspan="2">${escapeHtml(vehicle?.plate || "")}</td>
        </tr>
        <tr>
          <th colspan="3">GÖREVLİ PERSONELİN</th>
          <th>Ait Olduğu Kuruluş</th>
          <td colspan="2">Sosyal Yardımlaşma ve Dayanışma Vakfı</td>
        </tr>
        <tr>
          <th>Adı Soyadı</th>
          <th colspan="2">Ünvanı</th>
          <td colspan="3">${escapeHtml(vehicle?.brand || "")}</td>
        </tr>

        ${passengerRows}

        <tr>
          <th>Görevin Türü</th>
          <td colspan="5">${escapeHtml(record.taskName)}</td>
        </tr>
        <tr>
          <th>Gidilecek Yer</th>
          <td colspan="3">${escapeHtml(record.destination)}</td>
          <td>............... ${escapeHtml(record.outKm || "")} Km.</td>
          <td>............... ${escapeHtml(record.returnKm || "")} Km.</td>
        </tr>

        <tr>
          <td class="form-note" colspan="6">
            NOT: Araç sürücüleri ile araçta bulunan görevliler resmi sıfatın gerektirdiği saygınlığa uygun davranışlarda bulunacaktır.<br>
            Sürücüler görev süresince araç içinde sigara içmeyecektir.
          </td>
        </tr>
      </table>
    </article>
  `);
}

function printVehicleLedger() {
  const vehicle = getById(vehicles, refs.ledgerVehicleFilter.value);
  const ledgerRecords = vehicleLedgerRecords(vehicle?.id);
  const monthName = monthNames[Number(refs.monthFilter.value) - 1];
  const totalKm = ledgerRecords.reduce((sum, record) => sum + getKm(record), 0);

  printWithHtml(`
    <style>
      @page {
        size: A4 landscape;
        margin: 9mm;
      }
    </style>
    <article class="print-document ledger-print">
      <div class="ledger-print-title">
        <p>Göksun Sosyal Yardımlaşma ve Dayanışma Vakfı</p>
        <h1>ARAÇ KAYIT DEFTERİ</h1>
        <div>${escapeHtml(vehicle?.plate || "")} ${vehicle?.brand ? `- ${escapeHtml(vehicle.brand)}` : ""}</div>
        <div>${escapeHtml(monthName)} ${escapeHtml(refs.yearFilter.value)}</div>
      </div>

      <table class="vehicle-ledger-table">
        <thead>
          <tr>
            <th>TARİH</th>
            <th>ŞOFÖR ADI SOYADI</th>
            <th>ARAÇ PLAKASI</th>
            <th>ÇIKIŞ SAATİ</th>
            <th>ÇIKIŞ KM</th>
            <th>DÖNÜŞ SAATİ</th>
            <th>DÖNÜŞ KM</th>
            <th>GİTTİĞİ YER</th>
            <th>GÖREVİ</th>
            <th>İMZA</th>
          </tr>
        </thead>
        <tbody>${renderVehicleLedgerRows(ledgerRecords, true)}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOPLAM</td>
            <td colspan="3">${totalKm} KM</td>
            <td colspan="3">Kayıt sayısı: ${ledgerRecords.length}</td>
          </tr>
        </tfoot>
      </table>
    </article>
  `);
}

function printPersonReport() {
  const person = getById(people, refs.personReportFilter.value);
  const rows = personMissionRecords(person?.id);
  const monthName = monthNames[Number(refs.monthFilter.value) - 1];

  printWithHtml(`
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
    </style>
    <article class="print-document person-report-print">
      <h1>PERSONEL GÖREV RAPORU</h1>
      <div class="print-meta">
        <span>Personel: ${escapeHtml(person?.name || "")}</span>
        <span>Dönem: ${escapeHtml(monthName)} ${escapeHtml(refs.yearFilter.value)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Araç Plakası</th>
            <th>Şoför</th>
            <th>Görevin Türü</th>
            <th>Gidilecek Yer</th>
            <th>Çıkış / Dönüş Saati</th>
            <th>KM</th>
          </tr>
        </thead>
        <tbody>${rows.length ? renderPersonMissionRows(rows) : `<tr><td colspan="7">Kayıt yok.</td></tr>`}</tbody>
      </table>
    </article>
  `);
}

function printCurrentReport() {
  const monthName = monthNames[Number(refs.monthFilter.value) - 1];
  const visible = filteredRecords();
  const rows = visible
    .map((record) => {
      const vehicle = getById(vehicles, record.vehicleId);
      const driver = getById(drivers, record.driverId);
      return `
        <tr>
          <td>${formatDate(record.startDate)}</td>
          <td>${escapeHtml(vehicle?.plate || "")}</td>
          <td>${escapeHtml(driver?.name || "")}</td>
          <td>${escapeHtml(record.taskName)}</td>
          <td>${escapeHtml(record.destination)}</td>
          <td>${getKm(record)}</td>
        </tr>
      `;
    })
    .join("");

  printWithHtml(`
    <article class="print-document">
      <h1>${escapeHtml(monthName)} ${escapeHtml(refs.yearFilter.value)} AYLIK TAŞIT GÖREV İCMALİ</h1>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Plaka</th>
            <th>Sürücü</th>
            <th>Görev</th>
            <th>Yer</th>
            <th>KM</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">Kayıt yok.</td></tr>`}</tbody>
      </table>
    </article>
  `);
}

function renderDefinitionEditor() {
  const config = definitionConfig[activeDefinitionType];

  refs.definitionTabs.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.definitionType === activeDefinitionType);
  });

  refs.definitionForm.querySelector("button[type='submit']").textContent = config.addLabel;

  if (activeDefinitionType === "vehicles") {
    refs.definitionFields.innerHTML = `
      <label>
        Plaka
        <input name="plate" required placeholder="46 ABC 123">
      </label>
      <label>
        Marka / Model
        <input name="brand" required placeholder="Renault Kangoo">
      </label>
      <label class="span-2">
        Mevcut KM
        <input name="currentKm" type="number" min="0" inputmode="numeric" value="0">
      </label>
    `;
  } else {
    refs.definitionFields.innerHTML = `
      <label>
        Ad Soyad
        <input name="name" required placeholder="Ad Soyad">
      </label>
      <label>
        Görev / Unvan
        <input name="title" required placeholder="Görev / Unvan">
      </label>
    `;
  }

  renderDefinitionRows();
}

function renderDefinitionRows() {
  const list = getDefinitionList();

  if (activeDefinitionType === "vehicles") {
    refs.definitionHead.innerHTML = `
      <tr>
        <th>Plaka</th>
        <th>Marka / Model</th>
        <th>KM</th>
        <th class="narrow">İşlem</th>
      </tr>
    `;

    refs.definitionRows.innerHTML = list
      .map(
        (vehicle) => `
          <tr>
            <td>${escapeHtml(vehicle.plate)}</td>
            <td>${escapeHtml(vehicle.brand)}</td>
            <td>${escapeHtml(vehicle.currentKm ?? 0)}</td>
            <td class="narrow">
              <button class="mini-btn delete" data-definition-delete="${escapeHtml(vehicle.id)}" type="button">Sil</button>
            </td>
          </tr>
        `
      )
      .join("");
    return;
  }

  refs.definitionHead.innerHTML = `
    <tr>
      <th>Ad Soyad</th>
      <th>Görev / Unvan</th>
      <th class="narrow">İşlem</th>
    </tr>
  `;

  refs.definitionRows.innerHTML = list
    .map(
      (person) => `
        <tr>
          <td>${escapeHtml(person.name)}</td>
          <td>${escapeHtml(person.title)}</td>
          <td class="narrow">
            <button class="mini-btn delete" data-definition-delete="${escapeHtml(person.id)}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function addDefinition(event) {
  event.preventDefault();
  if (!requireSharedWrite()) return;
  const list = getDefinitionList();
  const formData = new FormData(refs.definitionForm);

  if (activeDefinitionType === "vehicles") {
    const plate = normalizeName(formData.get("plate") || "");
    const brand = normalizeText(formData.get("brand") || "");
    const currentKm = Number(formData.get("currentKm") || 0);

    if (!plate || !brand) {
      showConflict(["Plaka ve marka/model alanları boş bırakılamaz."]);
      return;
    }

    if (list.some((vehicle) => vehicle.plate.toLocaleUpperCase("tr-TR") === plate)) {
      showConflict(["Bu plaka zaten araç listesinde var."]);
      return;
    }

    list.push({
      id: makeDefinitionId(activeDefinitionType),
      plate,
      brand,
      currentKm: Number.isFinite(currentKm) ? currentKm : 0
    });
  } else {
    const name = normalizeName(formData.get("name") || "");
    const title = normalizeText(formData.get("title") || "");

    if (!name || !title) {
      showConflict(["Ad soyad ve görev/unvan alanları boş bırakılamaz."]);
      return;
    }

    if (list.some((person) => person.name.toLocaleUpperCase("tr-TR") === name)) {
      showConflict(["Bu isim zaten seçili listede var."]);
      return;
    }

    list.push({
      id: makeDefinitionId(activeDefinitionType),
      name,
      title
    });
  }

  saveDefinitions();
  refs.definitionForm.reset();
  refreshSelectOptions();
  renderDefinitionEditor();
  showNotice(`${definitionConfig[activeDefinitionType].label} eklendi.`);
}

function deleteDefinition(id) {
  if (!requireSharedWrite()) return;
  const list = getDefinitionList();
  const config = definitionConfig[activeDefinitionType];
  const item = list.find((entry) => entry.id === id);
  if (!item) return;

  if (list.length <= 1) {
    showConflict([`Son ${config.label.toLocaleLowerCase("tr-TR")} kaydı silinemez.`]);
    return;
  }

  if (isDefinitionUsed(activeDefinitionType, id)) {
    showConflict([`Bu ${config.label.toLocaleLowerCase("tr-TR")} daha önce görev kaydında kullanıldığı için silinemez.`]);
    return;
  }

  const label = activeDefinitionType === "vehicles" ? item.plate : item.name;
  if (!window.confirm(`${label} silinsin mi?`)) return;

  const index = list.findIndex((entry) => entry.id === id);
  list.splice(index, 1);
  saveDefinitions();
  refreshSelectOptions();
  renderDefinitionEditor();
  showNotice(`${config.label} silindi.`);
}

function bindEvents() {
  document.querySelector("#newRecordBtn").addEventListener("click", () => setForm(null));
  document.querySelector("#saveRecordBtn").addEventListener("click", saveCurrentRecord);
  document.querySelector("#deleteRecordBtn").addEventListener("click", deleteCurrentRecord);
  document.querySelector("#printMissionBtn").addEventListener("click", printCurrentMission);
  document.querySelector("#printLedgerBtn").addEventListener("click", printVehicleLedger);
  document.querySelector("#printReportBtn").addEventListener("click", printCurrentReport);
  document.querySelector("#printPersonReportBtn").addEventListener("click", printPersonReport);
  document.querySelector("#newFuelBtn").addEventListener("click", () => setFuelForm(null));
  document.querySelector("#saveFuelBtn").addEventListener("click", saveFuelRecord);
  document.querySelector("#printFuelReportBtn").addEventListener("click", printFuelReport);

  refs.addPassengerBtn.addEventListener("click", addPassenger);
  refs.definitionForm.addEventListener("submit", addDefinition);

  refs.definitionTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-definition-type]");
    if (!button) return;
    activeDefinitionType = button.dataset.definitionType;
    renderDefinitionEditor();
  });

  refs.sideTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-side-panel]");
    if (!button) return;

    document.querySelectorAll(".side-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    document.querySelectorAll(".side-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === button.dataset.sidePanel);
    });
  });

  refs.definitionRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-definition-delete]");
    if (!button) return;
    deleteDefinition(button.dataset.definitionDelete);
  });

  refs.passengerRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-passenger]");
    if (!button) return;
    selectedPassengers = selectedPassengers.filter((id) => id !== button.dataset.removePassenger);
    renderPassengers();
  });

  refs.recordRows.addEventListener("click", (event) => {
    const row = event.target.closest("[data-record-id]");
    if (!row) return;
    const record = records.find((item) => item.id === row.dataset.recordId);
    if (record) setForm(record);
  });

  refs.pendingReturnRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-return]");
    if (!button) return;
    editReturnInfo(button.dataset.editReturn);
  });

  refs.fuelVehicleId.addEventListener("input", () => {
    if (!selectedFuelId) refs.fuelKm.value = getSuggestedFuelKm(refs.fuelVehicleId.value);
    renderFuelRecords();
  });

  [refs.fuelStartDate, refs.fuelEndDate].forEach((input) => {
    input.addEventListener("input", renderFuelRecords);
  });

  refs.fuelRows.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-fuel]");
    if (editButton) {
      const record = fuelRecords.find((item) => item.id === editButton.dataset.editFuel);
      if (record) setFuelForm(record);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-fuel]");
    if (deleteButton) deleteFuelRecord(deleteButton.dataset.deleteFuel);
  });

  [refs.monthFilter, refs.yearFilter, refs.searchFilter, refs.quarterFilter, refs.ledgerVehicleFilter, refs.personReportFilter].forEach((input) => {
    input.addEventListener("input", () => {
      renderRecords();
      renderReport();
      renderPersonReport();
      renderVehicleLedger();
    });
  });

  [
    refs.unitResponsibleId,
    refs.requesterId,
    refs.approverId,
    refs.driverId,
    refs.vehicleId,
    refs.startDate,
    refs.endDate,
    refs.startTime,
    refs.endTime
  ].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === refs.startDate) {
        refs.endDate.value = refs.startDate.value;
      }
      if (input === refs.vehicleId && !selectedId) {
        refs.outKm.value = getSuggestedOutKm(refs.vehicleId.value);
      }
      updatePreviews();
      updateConflictBox();
    });
  });
}

function addPassenger() {
  const id = refs.passengerPicker.value;
  if (!id || selectedPassengers.includes(id)) return;
  if (selectedPassengers.length >= 4) {
    showConflict(["Görev emri çıktısında en fazla 4 görevli personel yer alabilir."]);
    return;
  }
  selectedPassengers.push(id);
  renderPassengers();
}

async function init() {
  if (await redirectFilePageToNetwork()) return;
  const usingSharedData = await loadSharedState();
  if (!usingSharedData) {
    loadDefinitions();
    loadRecords();
    loadFuelRecords();
    if (location.protocol === "file:") {
      refs.dataMode.textContent = "Ağ sunucusu kapalı: kayıt işlemleri devre dışı";
      showConflict(["Bu sayfa dosya olarak açılmış. Kayıt için baslat-ag-sunucusu.bat çalışmalı ve program http://...:8080 adresinden açılmalıdır."]);
    } else {
      refs.dataMode.textContent = "Ağ veri bağlantısı kurulamadı: kayıt işlemleri devre dışı";
    }
  }

  fillFilters();
  refs.fuelStartDate.value = refs.fuelStartDate.value || firstDayOfMonth();
  refs.fuelEndDate.value = refs.fuelEndDate.value || today();
  refreshSelectOptions();
  bindEvents();
  renderDefinitionEditor();
  renderReport();
  renderPersonReport();
  renderVehicleLedger();
  setFuelForm(null);
  renderFuelRecords();
  setForm(records[0] || null);
  window.addEventListener("pagehide", saveSharedStateOnClose);
}

init();
