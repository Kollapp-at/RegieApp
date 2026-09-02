(function () {
  "use strict";

  if (window.HasplV050Search) return;

  const MANUAL_PROJECT = "__manual__";
  const WORK_TYPES = ["regie", "daily", "material"];
  const DAY_MS = 86400000;
  let user = {};
  let master = { projects: [], employees: [], vehicles: [], branches: [] };
  let reports = [];
  let renderTimer = null;
  let lastOwnMutation = 0;
  let observer;

  const byId = (id) => document.getElementById(id);
  const text = (value) => String(value ?? "");

  function normalize(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/gi, "ss")
      .toLocaleLowerCase("de-AT");
  }

  function dateOnly(value) {
    const raw = text(value).trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (dotted) match = [dotted[0], dotted[3], dotted[2], dotted[1]];
    }
    if (!match) return null;
    const result = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
    );
    return Number.isNaN(result.getTime()) ? null : result;
  }

  function dateKey(value) {
    const date = dateOnly(value);
    if (!date) return "";
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function localDateLabel(value) {
    const date = dateOnly(value);
    return date
      ? new Intl.DateTimeFormat("de-AT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(date)
      : "";
  }

  function isoWeek(value) {
    const date = dateOnly(value);
    if (!date) return null;
    const target = new Date(date.getTime());
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
      label: `KW ${week}/${isoYear}`,
    };
  }

  function actualReportDate(report) {
    return (
      report.reportDate ||
      report.date ||
      report.periodFrom ||
      report.weekStart ||
      report.dateFrom ||
      ""
    );
  }

  function timestamp(value) {
    const result = Date.parse(text(value));
    return Number.isFinite(result) ? result : 0;
  }

  function compareReports(a, b) {
    const dateA = dateKey(actualReportDate(a));
    const dateB = dateKey(actualReportDate(b));
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const updated = timestamp(b.updatedAt) - timestamp(a.updatedAt);
    if (updated) return updated;
    const created = timestamp(b.createdAt) - timestamp(a.createdAt);
    if (created) return created;
    return text(b.id).localeCompare(text(a.id));
  }

  function sorted(values) {
    return values.slice().sort(compareReports);
  }

  function projectFor(report) {
    return (
      master.projects.find(
        (project) => String(project.id) === String(report.projectId),
      ) ||
      report.manualProject ||
      {}
    );
  }

  function projectName(report) {
    return text(report.projectName || projectFor(report).name || "Baustelle");
  }

  function creatorName(report) {
    if (report.createdByName) return text(report.createdByName);
    if (report.createdBy && String(report.createdBy) === String(user.id)) {
      return (
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        text(user.username) ||
        "Ich"
      );
    }
    const employee = master.employees.find(
      (item) =>
        String(item.linkedUserId || "") === String(report.createdBy || ""),
    );
    return text(employee?.fullName || employee?.name || report.createdBy);
  }

  function workKind(report) {
    if (report.type !== "work") return "";
    if (report.kinds?.regie) return "regie";
    if (report.kinds?.daily) return "daily";
    if (report.kinds?.material) return "material";
    return "";
  }

  function typeLabel(report) {
    if (report.type === "weekly") return "Wochenbericht";
    if (report.type === "regie-request") return "Regieanforderung";
    return {
      regie: "Regiebericht",
      daily: "Tagesbericht",
      material: "Materialbericht",
    }[workKind(report)] || "Arbeitsbericht";
  }

  function statusValue(report) {
    if (report.conflict) return "conflict";
    return report.syncStatus || "local";
  }

  function statusLabel(report) {
    const sync = {
      synced: "Synchronisiert",
      pending: "Ausständig",
      error: "Sync-Fehler",
      conflict: "Konflikt",
      local: "Nur lokal",
    }[statusValue(report)] || statusValue(report);
    const completion = {
      open: "Arbeiten offen",
      partial: "Teilfertig",
      completed: "Baustelle abgeschlossen",
    }[report.completion];
    return [completion, sync].filter(Boolean).join(" · ");
  }

  function addDateTerms(values, value) {
    const key = dateKey(value);
    if (!key) return;
    const week = isoWeek(key);
    const [year, month, day] = key.split("-");
    values.push(
      key,
      `${day}.${month}.${year}`,
      `${day}${month}${year}`,
      `${year}${month}${day}`,
      week?.key || "",
      week ? `kw${week.week}` : "",
      week ? String(week.week) : "",
    );
  }

  function collectValues(value, values, seen, depth = 0) {
    if (value == null || depth > 7) return;
    if (typeof value === "string" || typeof value === "number") {
      const candidate = text(value);
      if (candidate.length < 3000) values.push(candidate);
      return;
    }
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => collectValues(item, values, seen, depth + 1));
      return;
    }
    Object.entries(value).forEach(([key, item]) => {
      if (
        /dataurl|preview|thumbnail|drawing|background|signature|filedata|blob/i.test(
          key,
        )
      )
        return;
      collectValues(item, values, seen, depth + 1);
    });
  }

  function searchText(report, allReports) {
    const values = [
      typeLabel(report),
      projectName(report),
      creatorName(report),
      statusLabel(report),
    ];
    addDateTerms(values, actualReportDate(report));
    collectValues(report, values, new WeakSet());

    const project = projectFor(report);
    collectValues(project, values, new WeakSet());

    const linkedIds = new Set([
      ...(Array.isArray(report.linkedReportIds) ? report.linkedReportIds : []),
      ...(Array.isArray(report.relatedReportIds) ? report.relatedReportIds : []),
      ...(Array.isArray(report.linkedReports) ? report.linkedReports : []),
    ].map((id) => text(id)));
    if (linkedIds.size) {
      allReports
        .filter((item) => linkedIds.has(text(item.id)))
        .forEach((item) => {
          values.push(
            item.reportNo,
            item.requestNo,
            item.projectName,
            typeLabel(item),
          );
          addDateTerms(values, actualReportDate(item));
        });
    }
    return normalize(values.filter(Boolean).join(" "));
  }

  function matchesSearch(report, query, allReports) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = searchText(report, allReports);
    return terms.every((term) => haystack.includes(term));
  }

  function selected(id) {
    return text(byId(id)?.value);
  }

  function matchesDateFilters(report, prefix) {
    const date = dateKey(actualReportDate(report));
    const from = selected(`${prefix}FilterFrom`);
    const to = selected(`${prefix}FilterTo`);
    const week = selected(`${prefix}FilterWeek`);
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    if (week && isoWeek(date)?.key !== week) return false;
    return true;
  }

  function matchesProject(report, prefix) {
    const filter = selected(`${prefix}FilterProject`);
    if (!filter) return true;
    return filter === MANUAL_PROJECT
      ? !!report.manualProject
      : String(report.projectId || "") === filter;
  }

  function matchesStatus(report, prefix) {
    const status = selected(`${prefix}FilterStatus`);
    if (status) return statusValue(report) === status;
    const sync = selected(`${prefix}FilterSync`);
    if (sync && statusValue(report) !== sync) return false;
    const completion = selected(`${prefix}FilterCompletion`);
    if (completion && report.completion !== completion) return false;
    return true;
  }

  function filterReports(values, prefix, allReports) {
    const query = selected(`${prefix}FilterSearch`);
    const kind = selected(`${prefix}FilterKind`);
    return sorted(values).filter(
      (report) =>
        matchesSearch(report, query, allReports) &&
        matchesProject(report, prefix) &&
        (!kind || workKind(report) === kind) &&
        matchesStatus(report, prefix) &&
        matchesDateFilters(report, prefix) &&
        (!selected(`${prefix}FilterCreator`) ||
          String(report.createdBy || "") === selected(`${prefix}FilterCreator`)),
    );
  }

  function appendText(parent, tag, value, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function reportCard(report) {
    const card = document.createElement("article");
    card.className = "reportItem";
    card.dataset.reportId = text(report.id);
    card.dataset.reportType = text(report.type);
    const title = `${typeLabel(report)} ${report.reportNo || report.requestNo || ""} · ${projectName(report)}`.trim();
    appendText(card, "b", title);
    const week = isoWeek(actualReportDate(report));
    const details = [
      localDateLabel(actualReportDate(report)),
      week?.label,
      creatorName(report),
      statusLabel(report),
    ].filter(Boolean);
    appendText(card, "small", details.join(" · "));

    const actions = document.createElement("div");
    actions.className = "reportActions";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary";
    open.textContent = "Öffnen";
    open.addEventListener("click", () =>
      window.dispatchEvent(
        new CustomEvent("haspl-open-report", {
          detail: { id: report.id, type: report.type },
        }),
      ),
    );
    actions.append(open);
    if (
      window.RegiePrint &&
      !report.conflict
    ) {
      const print = document.createElement("button");
      print.type = "button";
      print.className = "secondary";
      print.textContent = "PDF erstellen";
      print.addEventListener("click", async () => {
        try {
          await window.RegiePrint.print(report, master);
          window.dispatchEvent(
            new CustomEvent("haspl-search-toast", {
              detail: "PDF wurde erstellt",
            }),
          );
        } catch (_) {
          window.dispatchEvent(
            new CustomEvent("haspl-search-toast", {
              detail: "PDF konnte nicht erstellt werden",
            }),
          );
        }
      });
      actions.append(print);
    }
    if (report.conflict) {
      const conflict = document.createElement("button");
      conflict.type = "button";
      conflict.className = "danger";
      conflict.textContent = "Konflikt lösen";
      conflict.addEventListener("click", () =>
        window.dispatchEvent(
          new CustomEvent("haspl-show-conflict", { detail: report }),
        ),
      );
      actions.append(conflict);
    }
    card.append(actions);
    return card;
  }

  function renderCollection(box, values) {
    if (!box) return;
    box.replaceChildren();
    box.classList.toggle("emptyState", values.length === 0);
    if (!values.length) {
      box.textContent = "Keine passenden Berichte gefunden.";
      return;
    }
    values.forEach((report) => box.append(reportCard(report)));
  }

  function isAdmin() {
    return ["admin", "development"].includes(
      String(user.role || "").toLowerCase(),
    );
  }

  function isVisible(report) {
    return isAdmin() || !user.id || String(report.createdBy) === String(user.id);
  }

  function renderAll() {
    const all = sorted(reports.filter((report) => !report.deletedAt));
    const visible = all.filter(isVisible);
    const work = visible.filter((report) => report.type === "work");
    const regie = visible.filter((report) => report.type === "regie-request");
    const weekly = visible.filter((report) => report.type === "weekly");

    renderCollection(
      byId("workList"),
      filterReports(work, "work", visible),
    );
    renderCollection(
      byId("regieList"),
      filterReports(regie, "regie", visible),
    );
    renderCollection(
      byId("weeklyList"),
      filterReports(weekly, "weekly", visible),
    );

    const recent = sorted(visible.filter((report) => report.type !== "weekly"))
      .slice(0, 6);
    renderCollection(byId("recentReports"), recent);
    if (byId("workResultCount")) {
      const filtered = filterReports(work, "work", visible);
      byId("workResultCount").textContent = `${filtered.length}/${work.length}`;
    }
    if (byId("regieResultCount")) {
      const filtered = filterReports(regie, "regie", visible);
      byId("regieResultCount").textContent = `${filtered.length}/${regie.length}`;
    }
    if (byId("weeklyResultCount")) {
      const filtered = filterReports(weekly, "weekly", visible);
      byId("weeklyResultCount").textContent = `${filtered.length}/${weekly.length}`;
    }
  }

  async function reload() {
    reports = await RegieDB.getAll("reports");
    lastOwnMutation = performance.now() + 40;
    renderAll();
  }

  function injectFilter(id, labelText, type = "week") {
    if (byId(id)) return;
    const anchor = byId(id.replace("Week", "Search"))?.closest(".filterGrid");
    if (!anchor) return;
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = type;
    label.append(input);
    anchor.append(label);
  }

  function injectStatusFilter(prefix) {
    const id = `${prefix}FilterStatus`;
    if (byId(id)) return;
    const anchor = byId(`${prefix}FilterSearch`)?.closest(".filterGrid");
    if (!anchor) return;
    const label = document.createElement("label");
    label.textContent = "Status";
    const select = document.createElement("select");
    select.id = id;
    [
      ["", "Alle Status"],
      ["synced", "Synchronisiert"],
      ["pending", "Ausständig"],
      ["local", "Nur lokal"],
      ["error", "Sync-Fehler"],
      ["conflict", "Konflikt"],
    ].forEach(([value, caption]) => select.add(new Option(caption, value)));
    label.append(select);
    anchor.append(label);
  }

  function fillProjectFilters() {
    ["work", "regie", "weekly"].forEach((prefix) => {
      const select = byId(`${prefix}FilterProject`);
      if (!select) return;
      const current = select.value;
      select.replaceChildren(new Option("Alle Baustellen", ""));
      select.add(new Option("Frei eingegebene Baustellen", MANUAL_PROJECT));
      master.projects
        .slice()
        .sort((a, b) =>
          text(a.name).localeCompare(text(b.name), "de", {
            sensitivity: "base",
          }),
        )
        .forEach((project) =>
          select.add(
            new Option(
              `${project.number ? `${project.number} · ` : ""}${project.name}`,
              project.id,
            ),
          ),
        );
      select.value = [...select.options].some(
        (option) => option.value === current,
      )
        ? current
        : "";
    });
  }

  function addListeners() {
    [
      "workFilterSearch",
      "workFilterProject",
      "workFilterKind",
      "workFilterCompletion",
      "workFilterSync",
      "workFilterFrom",
      "workFilterTo",
      "workFilterCreator",
      "workFilterWeek",
      "workFilterStatus",
      "regieFilterSearch",
      "regieFilterProject",
      "regieFilterSync",
      "regieFilterFrom",
      "regieFilterTo",
      "regieFilterCreator",
      "regieFilterWeek",
      "regieFilterStatus",
      "weeklyFilterSearch",
      "weeklyFilterProject",
      "weeklyFilterStatus",
      "weeklyFilterFrom",
      "weeklyFilterTo",
      "weeklyFilterWeek",
    ].forEach((id) => {
      const element = byId(id);
      if (!element || element.dataset.v050Bound) return;
      element.dataset.v050Bound = "true";
      element.addEventListener("input", queueRender);
      element.addEventListener("change", queueRender);
    });

    ["work", "regie", "weekly"].forEach((prefix) => {
      const button = byId(
        prefix === "weekly"
          ? "resetWeeklyFiltersBtn"
          : `reset${prefix[0].toUpperCase()}${prefix.slice(1)}FiltersBtn`,
      );
      if (!button || button.dataset.v050Bound) return;
      button.dataset.v050Bound = "true";
      button.addEventListener("click", () => {
        const container = button.closest(".filterCard") || button.closest(".view");
        container?.querySelectorAll("input, select").forEach((input) => {
          if (input !== button) input.value = "";
        });
        queueRender();
      });
    });
  }

  function queueRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      await reload();
      addListeners();
    }, 20);
  }

  function observeOriginalLists() {
    const targets = ["workList", "regieList", "recentReports"].map(byId).filter(Boolean);
    if (!targets.length || observer) return;
    observer = new MutationObserver(() => {
      if (performance.now() < lastOwnMutation) return;
      queueRender();
    });
    targets.forEach((target) => observer.observe(target, { childList: true }));
  }

  async function boot() {
    const auth = await window.HasplAuth?.ready;
    if (!auth?.ok || !window.RegieDB) return;
    user = auth.user || {};
    await RegieDB.open();
    master = (await window.RegieAPI?.load?.().catch(() => null)) || master;
    fillProjectFilters();
    injectFilter("workFilterWeek", "Kalenderwoche");
    injectFilter("regieFilterWeek", "Kalenderwoche");
    injectStatusFilter("regie");
    addListeners();
    window.addEventListener("regie-data-updated", queueRender);
    window.addEventListener("regie-sync-status", queueRender);
    window.addEventListener("online", queueRender);
    window.addEventListener("haspl-search-toast", (event) => {
      const toast = byId("toast");
      if (!toast) return;
      toast.textContent = event.detail;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2300);
    });
    observeOriginalLists();
    await reload();
  }

  window.HasplV050Search = Object.freeze({
    normalize,
    isoWeek,
    actualReportDate,
    compareReports,
    matchesSearch,
    reload,
  });
  boot().catch(() => {});
})();