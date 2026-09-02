(function () {
  "use strict";

  if (window.HasplWeekly) return;

  const MANUAL_PROJECT = "__manual__";
  const DAY_MS = 86400000;
  const HOUR_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "p50", "p100"];
  const DAY_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  let user = {};
  let master = { projects: [], employees: [], vehicles: [], branches: [] };
  let reports = [];
  let current = null;

  const byId = (id) => document.getElementById(id);
  const text = (value) => String(value ?? "").trim();
  const normalize = (value) =>
    text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/gi, "ss")
      .toLocaleLowerCase("de-AT");
  const today = () =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

  function dateKey(value) {
    const raw = text(value);
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (dotted) match = [dotted[0], dotted[3], dotted[2], dotted[1]];
    }
    if (!match) return "";
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
    );
    return Number.isNaN(date.getTime())
      ? ""
      : [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function isoWeek(value) {
    const key = dateKey(value);
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    const target = new Date(year, month - 1, day, 12);
    const weekday = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - weekday + 3);
    const isoYear = target.getFullYear();
    const weekOne = new Date(isoYear, 0, 4, 12);
    const week = 1 + Math.round(
      ((target.getTime() - weekOne.getTime()) / DAY_MS -
        3 +
        ((weekOne.getDay() + 6) % 7)) /
        7,
    );
    return {
      year: isoYear,
      week,
      key: `${isoYear}-W${String(week).padStart(2, "0")}`,
    };
  }

  function weekRange(value) {
    const match = text(value).match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    if (week < 1 || week > 53) return null;
    const januaryFourth = new Date(year, 0, 4, 12);
    const weekday = (januaryFourth.getDay() + 6) % 7;
    const monday = new Date(year, 0, 4, 12);
    monday.setDate(januaryFourth.getDate() - weekday + (week - 1) * 7);
    const sunday = new Date(monday.getTime());
    sunday.setDate(monday.getDate() + 6);
    const actual = isoWeek([monday.getFullYear(), String(monday.getMonth() + 1).padStart(2, "0"), String(monday.getDate()).padStart(2, "0")].join("-"));
    if (!actual || actual.key !== `${year}-W${String(week).padStart(2, "0")}`) return null;
    const toKey = (date) =>
      [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    return { year, week, key: `${year}-W${String(week).padStart(2, "0")}`, from: toKey(monday), to: toKey(sunday) };
  }

  function projectName(report) {
    return text(
      report.projectName ||
        master.projects.find((item) => String(item.id) === String(report.projectId))?.name ||
        report.manualProject?.name ||
        "Baustelle",
    );
  }

  function isDailyReport(report) {
    return (
      report?.type === "work" &&
      (report.kinds?.daily === true ||
        report.reportKind === "daily" ||
        report.reportType === "daily" ||
        report.kind === "daily")
    );
  }

  function belongsToProject(report, projectId) {
    return projectId === MANUAL_PROJECT
      ? !!report.manualProject
      : String(report.projectId || "") === String(projectId || "");
  }

  function unique(values) {
    const seen = new Set();
    return values
      .map(text)
      .filter((value) => value && !seen.has(normalize(value)) && seen.add(normalize(value)));
  }

  function valueList(value) {
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        typeof item === "object"
          ? [item.name, item.title, item.label, item.description, item.text, item.licensePlate]
          : [item],
      );
    }
    if (value && typeof value === "object") {
      return [value.name, value.title, value.label, value.description, value.text];
    }
    return [value];
  }

  function materialValue(material) {
    return {
      position: text(
        material?.lvPosition ||
          material?.position ||
          material?.pos ||
          material?.lvSubposition,
      ),
      name: text(
        material?.name ||
          material?.article ||
          material?.material ||
          material?.description ||
          material?.text,
      ),
      unit: text(material?.unit || material?.measurementUnit || material?.uom),
      quantity: material?.quantity ?? material?.qty ?? material?.amount ?? material?.menge ?? 0,
    };
  }

  function numberValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = text(value).replace(/\s/g, "").replace(",", ".");
    const result = Number(raw);
    return Number.isFinite(result) ? result : 0;
  }

  function linkedIds(report) {
    const fields = [
      report.linkedReportIds,
      report.relatedReportIds,
      report.regieReportIds,
      report.linkedRegieReportIds,
      report.linkedReports,
      report.regieReports,
    ];
    return new Set(
      fields
        .flatMap((items) => (Array.isArray(items) ? items : items ? [items] : []))
        .map((item) => (typeof item === "object" ? item.id || item.reportId : item))
        .map(text)
        .filter(Boolean),
    );
  }

  function aggregateDaily(projectId, weekKey, allReports = reports) {
    const range = weekRange(weekKey);
    const emptyDays = Array.from({ length: 7 }, (_, index) => ({
      index,
      date: "",
      label: DAY_LABELS[index],
      reports: [],
      reportIds: [],
      hours: 0,
    }));
    if (!range || !projectId) {
      return {
        range,
        reports: [],
        sourceReportIds: [],
        days: emptyDays,
        employees: [],
        materials: [],
        vehicles: [],
        incidents: [],
        works: [],
        openPoints: [],
        linkedRegieReports: [],
        totalHours: 0,
      };
    }

    const seenReports = new Set();
    const dailyReports = allReports
      .filter((report) => !report.deletedAt && isDailyReport(report))
      .filter((report) => belongsToProject(report, projectId))
      .map((report) => ({ report, date: dateKey(report.date || report.reportDate) }))
      .filter(({ date }) => date && date >= range.from && date <= range.to)
      .filter(({ report }) => {
        const id = text(report.id);
        if (!id || seenReports.has(id)) return false;
        seenReports.add(id);
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || text(a.reportNo).localeCompare(text(b.reportNo), "de"));

    const days = emptyDays.map((day, index) => {
      const date = new Date(range.from + "T12:00:00");
      date.setDate(date.getDate() + index);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      return { ...day, date: key, reports: [], reportIds: [] };
    });
    const employees = new Map();
    const materials = new Map();
    const vehicles = [];
    const incidents = [];
    const works = [];
    const openPoints = [];
    const linkedIdsSet = new Set();

    const addEmployee = (worker, report, dayIndex) => {
      const employeeId = text(worker.employeeId);
      const employeeName = text(
        worker.employeeName ||
          master.employees.find((item) => String(item.id) === employeeId)?.name ||
          employeeId ||
          "Mitarbeiter",
      );
      const key = employeeId || normalize(employeeName);
      if (!key) return;
      if (!employees.has(key)) {
        employees.set(key, {
          employeeId,
          employeeName,
          hours: Object.fromEntries(HOUR_KEYS.map((hourKey) => [hourKey, 0])),
          dayHours: Array(7).fill(0),
          total: 0,
          sourceReportIds: new Set(),
        });
      }
      const entry = employees.get(key);
      entry.employeeName = entry.employeeName || employeeName;
      entry.sourceReportIds.add(text(report.id));
      let total = 0;
      HOUR_KEYS.forEach((hourKey) => {
        const amount = Number(worker[hourKey]) || 0;
        entry.hours[hourKey] += amount;
        total += amount;
      });
      entry.dayHours[dayIndex] += total;
      entry.total += total;
    };

    dailyReports.forEach(({ report, date }) => {
      const dayIndex = days.findIndex((day) => day.date === date);
      if (dayIndex < 0) return;
      const day = days[dayIndex];
      day.reports.push(report);
      day.reportIds.push(text(report.id));
      const reportHours = (report.workers || []).reduce((sum, worker) => {
        addEmployee(worker, report, dayIndex);
        return sum + HOUR_KEYS.reduce((total, key) => total + (Number(worker[key]) || 0), 0);
      }, 0);
      day.hours += reportHours;

      if (text(report.services)) works.push(`${date} · ${text(report.services)}`);
      const materialRows = Array.isArray(report.materials) ? report.materials : [];
      materialRows.forEach((material) => {
        const normalized = materialValue(material);
        if (!normalized.position && !normalized.name) return;
        const positionKey = normalize(normalized.position);
        const nameKey = normalize(normalized.name);
        const unitKey = normalize(normalized.unit);
        const existing = [...materials.values()].find((item) => {
          if (normalize(item.unit) !== unitKey) return false;
          const existingPosition = normalize(item.lvPosition);
          const existingName = normalize(item.name);
          return (
            (positionKey && existingPosition && positionKey === existingPosition) ||
            (nameKey && existingName && nameKey === existingName)
          );
        });
        if (existing) {
          existing.lvPosition = existing.lvPosition || normalized.position;
          existing.name = existing.name || normalized.name;
          existing.quantity += numberValue(normalized.quantity);
          return;
        }
        const key = `${positionKey || nameKey}|${unitKey}`;
        materials.set(key, {
          lvPosition: normalized.position,
          name: normalized.name,
          unit: normalized.unit,
          quantity: numberValue(normalized.quantity),
        });
      });

      ["vehicles", "vehicleNames", "equipment", "devices", "machines", "vehicleEquipment"].forEach((field) => {
        vehicles.push(...valueList(report[field]));
      });
      ["incidents", "incident", "occurrences", "occurrence", "remark", "remarks", "specialNotes"].forEach((field) => {
        incidents.push(...valueList(report[field]).filter((value) => text(value)).map((value) => `${date} · ${text(value)}`));
      });
      ["openPoints", "openTasks", "outstanding", "toDo", "todos", "openItems"].forEach((field) => {
        openPoints.push(...valueList(report[field]).filter((value) => text(value)).map((value) => `${date} · ${text(value)}`));
      });
      if (report.completion === "open" && !valueList(report.openPoints || report.openTasks).some((value) => text(value))) {
        openPoints.push(`${date} · Arbeiten offen`);
      }
      linkedIds(report).forEach((id) => linkedIdsSet.add(id));
    });

    const linkedRegieReports = [...linkedIdsSet]
      .map((id) => allReports.find((report) => String(report.id) === id))
      .filter((report) => report && (report.type === "regie-request" || report.kinds?.regie))
      .map((report) =>
        [
          report.requestNo || report.reportNo || report.id,
          projectName(report),
          dateKey(report.periodFrom || report.date),
          text(report.services),
        ]
          .filter(Boolean)
          .join(" · "),
      );

    const totalHours = [...employees.values()].reduce((sum, employee) => sum + employee.total, 0);
    return {
      range,
      reports: dailyReports.map(({ report }) => report),
      sourceReportIds: dailyReports.map(({ report }) => text(report.id)),
      days,
      employees: [...employees.values()].map((employee) => ({
        ...employee,
        sourceReportIds: [...employee.sourceReportIds],
      })),
      materials: [...materials.values()],
      vehicles: unique(vehicles),
      incidents: unique(incidents),
      works: unique(works),
      openPoints: unique(openPoints),
      linkedRegieReports: unique(linkedRegieReports),
      totalHours,
    };
  }

  function fmt(value) {
    return new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function formatDate(value) {
    const key = dateKey(value);
    if (!key) return "";
    return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(key + "T12:00:00"));
  }

  function fillProjectSelect() {
    const select = byId("weeklyProject");
    if (!select) return;
    const currentValue = select.value;
    select.replaceChildren(new Option("Baustelle wählen", ""));
    select.add(new Option("✎ Baustelle frei eingeben", MANUAL_PROJECT));
    master.projects
      .slice()
      .sort((a, b) => text(a.name).localeCompare(text(b.name), "de", { sensitivity: "base" }))
      .forEach((project) => select.add(new Option(`${project.number ? `${project.number} · ` : ""}${project.name}`, project.id)));
    select.value = [...select.options].some((option) => option.value === currentValue) ? currentValue : "";
  }

  function setStatus(value, color) {
    const state = byId("weeklySaveState");
    if (state) {
      state.textContent = value;
      state.style.color = color || "";
    }
  }

  function showView(view) {
    document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `view-${view}`));
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view || (view === "weekly-editor" && button.dataset.view === "weekly")));
    window.scrollTo?.({ top: 0, behavior: "auto" });
  }

  function renderSource(aggregate) {
    const summary = byId("weeklySourceSummary");
    if (summary) {
      const daysWithReports = aggregate.days.filter((day) => day.reports.length).length;
      summary.textContent = aggregate.range
        ? `${aggregate.reports.length} Tagesbericht${aggregate.reports.length === 1 ? "" : "e"} an ${daysWithReports} von 7 Tagen · ${formatDate(aggregate.range.from)} bis ${formatDate(aggregate.range.to)}`
        : "Baustelle und Kalenderwoche wählen, um die Tagesberichte zu ermitteln.";
    }
    const daysBox = byId("weeklyDays");
    if (daysBox) {
      daysBox.replaceChildren();
      aggregate.days.forEach((day) => {
        const item = document.createElement("article");
        item.className = "weeklyDay";
        const heading = document.createElement("b");
        heading.textContent = `${day.label}, ${formatDate(day.date)}`;
        const details = document.createElement("small");
        details.textContent = day.reports.length
          ? `${day.reports.length} Bericht${day.reports.length === 1 ? "" : "e"} · ${fmt(day.hours)} h`
          : "Kein Tagesbericht";
        item.append(heading, details);
        daysBox.append(item);
      });
    }
    const employeesBox = byId("weeklyEmployees");
    if (employeesBox) {
      employeesBox.replaceChildren();
      if (!aggregate.employees.length) {
        employeesBox.className = "tableWrap emptyState";
        employeesBox.textContent = "Keine Mitarbeiterstunden in den gewählten Tagesberichten.";
      } else {
        employeesBox.className = "tableWrap";
        const table = document.createElement("table");
        const head = document.createElement("tr");
        ["Mitarbeiter", ...HOUR_KEYS.map((key) => key.toUpperCase()), "Summe"].forEach((label) => {
          const cell = document.createElement("th");
          cell.textContent = label;
          head.append(cell);
        });
        const thead = document.createElement("thead");
        thead.append(head);
        const body = document.createElement("tbody");
        aggregate.employees.forEach((employee) => {
          const row = document.createElement("tr");
          [employee.employeeName, ...HOUR_KEYS.map((key) => fmt(employee.hours[key])), fmt(employee.total)].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
          });
          body.append(row);
        });
        table.append(thead, body);
        employeesBox.append(table);
      }
    }
    const total = byId("weeklyHoursTotal");
    if (total) total.textContent = `${fmt(aggregate.totalHours)} h`;
  }

  function setAggregateFields(aggregate) {
    byId("weeklyWorks").value = aggregate.works.join("\n");
    byId("weeklyMaterials").value = aggregate.materials
      .map((item) => [item.lvPosition, item.name, item.quantity ? fmt(item.quantity) : "", item.unit].filter(Boolean).join(" · "))
      .join("\n");
    byId("weeklyVehicles").value = aggregate.vehicles.join("\n");
    byId("weeklyIncidents").value = aggregate.incidents.join("\n");
    byId("weeklyOpenPoints").value = aggregate.openPoints.join("\n");
    byId("weeklyRegieReports").value = aggregate.linkedRegieReports.join("\n");
  }

  function currentAggregate() {
    return aggregateDaily(byId("weeklyProject")?.value, byId("weeklyWeek")?.value, reports);
  }

  function refreshAggregate(overwrite) {
    const aggregate = currentAggregate();
    renderSource(aggregate);
    if (overwrite) setAggregateFields(aggregate);
    return aggregate;
  }

  async function reload() {
    reports = await RegieDB.getAll("reports");
    fillProjectSelect();
    if (byId("view-weekly")?.classList.contains("active")) refreshAggregate(false);
  }

  function newWeekly() {
    current = null;
    byId("weeklyForm").reset();
    byId("weeklyId").value = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const currentWeek = isoWeek(today());
    byId("weeklyWeek").value = currentWeek?.key || "";
    byId("deleteWeeklyBtn").hidden = true;
    byId("weeklyEditorTitle").textContent = "Neuer Wochenbericht";
    byId("weeklySourceSummary").textContent = "Baustelle und Kalenderwoche wählen, um die Tagesberichte zu ermitteln.";
    ["weeklyWorks", "weeklyMaterials", "weeklyVehicles", "weeklyIncidents", "weeklyOpenPoints", "weeklyRegieReports"].forEach((id) => { byId(id).value = ""; });
    renderSource(currentAggregate());
    setStatus("Noch nicht gespeichert");
    showView("weekly-editor");
  }

  async function editWeekly(id) {
    const report = reports.find((item) => item.id === id) || await RegieDB.get("reports", id);
    if (!report) return;
    current = report;
    byId("weeklyForm").reset();
    byId("weeklyId").value = report.id;
    byId("weeklyProject").value = report.projectId || (report.manualProject ? MANUAL_PROJECT : "");
    byId("weeklyWeek").value = report.weekKey || (report.isoYear && report.isoWeek ? `${report.isoYear}-W${String(report.isoWeek).padStart(2, "0")}` : "");
    byId("weeklyReportNo").value = report.reportNo || "";
    byId("weeklyTitle").value = report.title || "";
    byId("weeklyWorks").value = report.works || "";
    byId("weeklyMaterials").value = report.materialsText || "";
    byId("weeklyVehicles").value = report.vehiclesText || "";
    byId("weeklyIncidents").value = report.incidentsText || "";
    byId("weeklyOpenPoints").value = report.openPointsText || "";
    byId("weeklyRegieReports").value = report.linkedRegieReportsText || "";
    byId("deleteWeeklyBtn").hidden = false;
    byId("weeklyEditorTitle").textContent = `Wochenbericht ${report.reportNo || formatDate(report.weekStart)}`.trim();
    renderSource(currentAggregate());
    setStatus("Lokal gespeichert");
    showView("weekly-editor");
  }

  async function saveWeekly(event) {
    event.preventDefault();
    const form = byId("weeklyForm");
    if (!form.reportValidity()) return;
    const projectId = byId("weeklyProject").value;
    const range = weekRange(byId("weeklyWeek").value);
    if (!range || !projectId) return;
    const aggregate = currentAggregate();
    const old = current || await RegieDB.get("reports", byId("weeklyId").value);
    const record = {
      ...old,
      id: byId("weeklyId").value,
      type: "weekly",
      projectId: projectId === MANUAL_PROJECT ? "" : projectId,
      projectName: projectName({ projectId, manualProject: projectId === MANUAL_PROJECT ? { name: "Freie Baustelle" } : null }),
      weekKey: range.key,
      isoYear: range.year,
      isoWeek: range.week,
      weekStart: range.from,
      weekEnd: range.to,
      reportNo: text(byId("weeklyReportNo").value),
      title: text(byId("weeklyTitle").value),
      sourceReportIds: aggregate.sourceReportIds,
      sourceDays: aggregate.days.map((day) => ({ date: day.date, reportIds: day.reportIds, hours: day.hours })),
      employees: aggregate.employees,
      totalHours: aggregate.totalHours,
      works: text(byId("weeklyWorks").value),
      materialsText: text(byId("weeklyMaterials").value),
      vehiclesText: text(byId("weeklyVehicles").value),
      incidentsText: text(byId("weeklyIncidents").value),
      openPointsText: text(byId("weeklyOpenPoints").value),
      linkedRegieReportsText: text(byId("weeklyRegieReports").value),
      createdBy: old?.createdBy || user.id || "local-user",
      createdByName: old?.createdByName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Lokaler Benutzer",
      createdAt: old?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: "local",
    };
    await RegieDB.put("reports", record);
    current = record;
    await reload();
    window.dispatchEvent(new CustomEvent("regie-data-updated"));
    byId("deleteWeeklyBtn").hidden = false;
    byId("weeklyEditorTitle").textContent = `Wochenbericht ${record.reportNo || formatDate(record.weekStart)}`.trim();
    setStatus("Lokal gespeichert", "var(--green)");
  }

  async function deleteWeekly() {
    const id = byId("weeklyId").value;
    if (!id || !confirm("Wochenbericht wirklich löschen?")) return;
    await RegieDB.remove("reports", id);
    current = null;
    await reload();
    showView("weekly");
  }

  async function printWeekly() {
    const id = byId("weeklyId").value;
    const report = current || reports.find((item) => item.id === id);
    if (!report) return;
    try {
      await window.RegiePrint.print(report, master);
      const toast = byId("toast");
      toast.textContent = "PDF wurde erstellt";
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2300);
    } catch (error) {
      console.error(error);
      const toast = byId("toast");
      toast.textContent = "PDF konnte nicht erstellt werden";
      toast.classList.add("show");
    }
  }

  function bind() {
    byId("weeklyAddBtn").addEventListener("click", newWeekly);
    byId("weeklyBackBtn").addEventListener("click", () => showView("weekly"));
    byId("weeklyRefreshBtn").addEventListener("click", () => refreshAggregate(true));
    byId("weeklyProject").addEventListener("change", () => refreshAggregate(true));
    byId("weeklyWeek").addEventListener("change", () => refreshAggregate(true));
    byId("weeklyForm").addEventListener("input", () => setStatus("Ungespeicherte Änderungen", "var(--amber)"));
    byId("weeklyForm").addEventListener("submit", saveWeekly);
    byId("deleteWeeklyBtn").addEventListener("click", deleteWeekly);
    byId("printWeeklyBtn").addEventListener("click", printWeekly);
    window.addEventListener("haspl-open-report", (event) => {
      if (event.detail?.type === "weekly") editWeekly(event.detail.id);
    });
    window.addEventListener("regie-data-updated", reload);
  }

  async function boot() {
    const auth = await window.HasplAuth?.ready;
    if (!auth?.ok || !window.RegieDB) return;
    user = auth.user || {};
    await RegieDB.open();
    master = (await window.RegieAPI?.load?.().catch(() => null)) || master;
    fillProjectSelect();
    bind();
    await reload();
  }

  window.HasplWeekly = Object.freeze({ isoWeek, weekRange, aggregateDaily, reload });
  boot().catch((error) => console.error("Wochenberichte konnten nicht geladen werden", error));
})();