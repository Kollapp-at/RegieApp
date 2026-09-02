HASPL REGIEAPP V0.18.0
=====================

BASIS UND KOMPATIBILITÄT
------------------------
- Schrittweise Erweiterung der RegieApp V0.2.0, kein Redesign.
- Kompatibel mit dem Regie-Backend des HASPL App-Portals V0.10.2.
- Eigenständige PWA mit Scope /regieapp/.
- Bestehende IndexedDB haspl-regieapp-v1 bleibt erhalten.
- Additive IndexedDB-Migration von Version 1 auf 2.

NEU IN V0.18.0
----------------

- Wochenberichte aggregieren Tagesberichte lokal datumsrichtig von Montag bis Sonntag.
- Mitarbeiterstunden, Arbeiten, Material, Fahrzeuge/Geräte, Vorkommnisse, offene Punkte und verknüpfte Regieberichte werden zusammengeführt.
- Wochenberichte können angelegt, bearbeitet, gespeichert, wieder geöffnet, gelöscht und als PDF ausgegeben werden.
- Suche, Filterung und Sortierung berücksichtigen alle drei Berichtstypen.
- PDFs verwenden den vollständigen einheitlichen Firmensitz-Kopf der Elektrotechnik Haspl GmbH in Vorau.
- Das Release-ZIP wird separat neben der App als Installations- und Uploadpaket bereitgestellt.

NEU IN V0.4.5

- PDF-/Druckausgabe vollständig professionell überarbeitet
- offizieller HASPL-Firmenkopf aus den Portal-Daten des Firmensitzes Vorau
- kompakte, klar gruppierte Projekt- und Berichtsdaten
- optimierte Reihenfolge und dynamische Seitenumbrüche
- Freihandskizzen werden vollständig, proportional und ohne Teilung ausgegeben
- leere Skizzen werden in der PDF-Ausgabe übersprungen
- professionelle Tabellen, Statusbox, Unterschriftenbereiche und Fußzeilen
- keine Änderung an Erfassung, Synchronisation, Datenstruktur oder Offlinefunktion

BISHERIGER STAND V0.4.4
-------------
- Ein eingespieltes LV kann projektbezogen über „LV von Baustelle entfernen“ gelöscht werden.
- Vor dem Löschen zeigt ein Bestätigungsdialog, wie viele Berichte und LV-Zuordnungen betroffen sind.
- Berichte, Materialzeilen, Mengen, Einheiten, Preise und bereits gespeicherte LV-Positionsnummern bleiben vollständig erhalten.
- Alte LV-Bezüge bleiben beim späteren Öffnen und erneuten Speichern eines Berichtes sichtbar und werden nicht stillschweigend entfernt.
- Die Löschung funktioniert offline über die Synchronisierungswarteschlange und wird später an das Portal übertragen.
- Ein auf einem anderen Gerät gelöschtes LV wird beim nächsten Online-Abgleich auch lokal entfernt.
- Der bestehende Portal-Endpunkt zum Ersetzen des Projekt-LVs wird verwendet; Portal V0.10.2 benötigt dafür keine Änderung.
- Copyright-Hinweis „RegieApp © Mst. Dominic Höfler“ wie in KollApp und ZeitApp ergänzt.
- Der Löschdialog und die Kopfzeile wurden für Handy und Tablet responsiv abgesichert.
- Auch bei Skizzen kann das Papier zwischen liniert, kariert und leer umgestellt werden.
- Die durchsuchbare LV-Materialauswahl und freie Materialeingabe funktionieren in Arbeitsbericht und Regieanforderung identisch.
- Das PDF verwendet HASPL-Blau für Kopfzeile, Abschnittsmarkierungen und Gestaltungslinien.
- Der PDF-Kopf orientiert sich am Originalbericht mit Logo links, Firmendaten rechts und großer dynamischer Berichtsbezeichnung.
- Der Abschlussstatus ist farbcodiert: abgeschlossen grün, teilfertig orange und Arbeiten offen blau.
- Als verlässliche PDF-Standardfirmendaten werden die Angaben der Beispielberichte verwendet: Elektrotechnik Haspl GmbH, Bahnhofstraße 80, 8250 Vorau, 03337 30 006, office@elektro-haspl.at und www.elektro-haspl.at.
- „Baustelle frei eingeben“ und „Mitarbeiter frei eingeben“ stehen jeweils direkt oben in der Auswahlliste; Portal-Einträge folgen alphabetisch darunter.

WEITERHIN ENTHALTEN AUS V0.4.3
------------------------------
- Jede Materialzeile besitzt ein Suchfeld für LV-Positionsnummer und Positionstext.
- Erst nach Eingabe eines Suchbegriffs werden passende LV-Unterpositionen angezeigt.
- Die Trefferliste ist auf 100 passende Positionen begrenzt und bleibt dadurch auch bei großen LVs übersichtlich.
- Aktuell ausgewählte LV-Positionen bleiben beim Suchen und beim Projektwechsel erhalten.
- Freie Materialeingabe bleibt weiterhin möglich.
- Foto- und Aktionsbuttons besitzen ausreichend Platz und brechen auf schmalen Bildschirmen sauber um.
- Sehr schmale Foto-Karten stellen „Markieren“ und „Entfernen“ untereinander dar.
- Weitere Buttongruppen, Speichernleisten und Dialogaktionen wurden gegen abgeschnittene Beschriftungen abgesichert.

WEITERHIN ENTHALTEN AUS V0.4.2
------------------------------
- Dropdown-Optionen sind im Dark Mode vollständig lesbar.
- Der Farbwähler zeigt die gewählte Stiftfarbe direkt neben „Farbe“ an.
- Die Einheit „Psch“ wurde durch „PA“ ersetzt; bestehende Altwerte werden als „PA“ angezeigt.
- Direkte lokale PDF-Erzeugung ohne Browser-Kopf- und Fußzeilen.
- Kompakte PDF-Kopfdaten; leere Datenzeilen werden ausgelassen und Texte umbrechen ohne Überlappung.
- Ein typischer Bericht wird auf einer A4-Seite angeordnet; weitere Seiten entstehen nur bei tatsächlich fehlendem Platz.
- Die Kostenstelle bleibt eine Portalzuordnung und wird im Berichts-PDF nicht ausgegeben.
- Die handschriftliche Arbeitsleistung erweitert sich beim Schreiben automatisch nach unten.
- In das PDF wird nur der tatsächlich beschriebene Ausschnitt der Handschrift übernommen.

WEITERHIN ENTHALTEN AUS V0.4.1
------------------------------
- Normale Benutzer sehen ausschließlich Berichte und Regieanforderungen, die sie selbst erstellt haben.
- Administratoren sehen alle Berichte und zusätzlich den Ersteller in der Liste.
- Such- und Filterleiste für Arbeitsberichte: Text, Baustelle, Berichtstyp, Abschlussstatus, Synchronisation und Zeitraum.
- Such- und Filterleiste für Regieanforderungen: Text, Baustelle, Synchronisation und Zeitraum.
- Administratoren können zusätzlich nach Ersteller filtern.
- Ergebniszähler und Funktion zum Zurücksetzen aller Filter.

WEITERHIN ENTHALTEN AUS V0.4.0
------------------------------
- Berichtstyp ist eine Einzelauswahl: Regiebericht, Tagesbericht oder Materialbericht.
- Bei neuen Berichten ist kein Berichtstyp und kein Abschlussstatus vorausgewählt.
- Speichern ohne Berichtstyp oder Abschlussstatus wird mit einem Dialog verhindert.
- Die PDF-/Druckausgabe verwendet den gewählten Berichtstyp als große Dokumentüberschrift.
- PDF-Layout mit klarer Kopfzeile, Berichtsnummer, Datenblöcken, Tabellen, Status und Unterschriften überarbeitet.
- Baustellen- und Mitarbeiterdaten werden aus dem Portal übernommen.
- Baustelle und Mitarbeiter können alternativ frei eingetragen werden.
- Berichte für eine freie Baustelle bleiben bewusst lokal und können als PDF ausgegeben werden.
- Material kann je Zeile aus einer importierten LV-Unterposition oder frei erfasst werden.
- LV-Text, Einheit und bei Regieanforderungen der LV-Preis werden automatisch übernommen.
- Materialeinheit über Dropdown oder freie Zusatzeingabe.
- Handschriftliche Arbeitsleistung ist standardmäßig liniert und kann auf kariert oder leer umgeschaltet werden.

WEITERHIN ENTHALTEN AUS V0.3.2
------------------------------
- Dark Mode ist bei der ersten Verwendung standardmäßig aktiv.
- Eigener Theme-Schalter wie in KollApp und ZeitApp; Einstellung bleibt lokal gespeichert.
- Neues RegieApp-R-Logo im einheitlichen Stil von KollApp und ZeitApp.
- Buttons und Dialoge für Maus-, Touch- und Tablet-Bedienung geprüft.
- Der Schließen-Button im Benutzerfenster ist als echter Dialog-Button festgelegt.
- Dynamisch erzeugte Zeilen-, Foto- und Listenbuttons lösen kein ungewolltes Formular-Speichern aus.
- Arbeitsleistungen können optional mit Apple Pencil, S Pen, Finger oder Maus handschriftlich erfasst werden.
- Handschriftliche Arbeitsleistungen werden lokal, im Portal und in der Druck-/PDF-Ausgabe mitgeführt.

WEITERHIN ENTHALTEN AUS DER VORVERSION
--------------------------------------
- Berichtsbezogene Fotos, markierte Bilder, Skizzen und Unterschriften werden aus dem Portal geladen.
- Auf einem zweiten Gerät geladene Bilddaten werden lokal in IndexedDB gespeichert und stehen danach offline zur Verfügung.
- Portal-Kompatibilität auf V0.10.2 erweitert.

WEITERHIN ENTHALTEN AUS V0.3.0
------------------------------
- Zentrale Synchronisation von Arbeitsberichten und Regieanforderungen.
- Stabile clientseitige UUID und Portal-Revision pro Bericht.
- Robuste IndexedDB-Sync-Queue mit Wiederholungszähler.
- Status: lokal, ausständig, synchronisiert, Fehler oder Konflikt.
- Sichere Konfliktentscheidung: Server-Version oder lokale Version behalten.
- Upload von Fotos, markierten Bildern, Skizzen und Unterschriften per multipart/form-data.
- Projektbezogene LV-Synchronisation nach lokaler Prüfung und Bestätigung.
- Abruf neuerer Portal-LVs bei bestehender Onlineverbindung.
- Kostenstellen- und erweiterte Projekt-/Auftraggeberdaten aus Portal V0.10.2.
- Sichtbar wird ausschließlich die Bezeichnung „Kostenstelle“ verwendet.
- Lokale Druck-/PDF-Ausgabe für Arbeitsberichte und Regieanforderungen, auch offline.
- Portal-Funktionsrechte werden in der Benutzeroberfläche berücksichtigt.

WEITERHIN VOLLSTÄNDIG LOKAL VERFÜGBAR
------------------------------------
- Bericht erfassen und speichern
- Fotos aufnehmen und beschreiben
- Fotos markieren und Skizzen zeichnen
- Unterschriften erfassen
- Excel-, CSV- und Text-PDF-LV einlesen und prüfen
- LV-Positionen in Berichten auswählen
- Bericht direkt als PDF-Datei erzeugen

VERWENDETE PORTAL-ENDPUNKTE
---------------------------
GET  /api/auth/me
GET  /api/projects
GET  /api/employees
GET  /api/vehicles
GET  /api/branches

GET/POST          /api/regie/work-reports
GET/PATCH/DELETE  /api/regie/work-reports/:id
GET/POST          /api/regie/requests
GET/PATCH/DELETE  /api/regie/requests/:id
GET/PUT            /api/regie/projects/:projectId/lv
POST               /api/regie/attachments
GET                /api/regie/attachments?report_id=...&report_type=...
GET/DELETE         /api/regie/attachments/:id
GET                /api/regie/attachments/:id/file

OFFLINE- UND KONFLIKTVERHALTEN
------------------------------
Jede Änderung wird zuerst lokal gespeichert. Bei fehlender Verbindung bleibt sie in der Sync-Queue.
Synchronisiert wird beim Start, nach dem Online-Ereignis und beim Antippen der Statusanzeige.
Nach fünf automatischen Fehlversuchen wird keine Endlosschleife erzeugt; manuelles Wiederholen bleibt möglich.
Bei HTTP 409 wird nichts überschrieben. Beide Versionen bleiben bis zur bewussten Entscheidung erhalten.

INSTALLATION
------------
Den gesamten Inhalt dieses Ordners als eigenständige App unter /regieapp/ bereitstellen.
Die Portal-Version selbst und andere Einzelapps werden durch dieses Paket nicht überschrieben.

BEKANNTE EINSCHRÄNKUNGEN
------------------------
- Wochenberichte bleiben lokal; die bestehende Synchronisierung unterstützt weiterhin Arbeitsberichte und Regieanforderungen.
