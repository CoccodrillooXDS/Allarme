const rawData = document.getElementById("rawData");
const storicoTable = document.getElementById("storicoTable");
const rawInput = document.getElementById("rawInput");

var pulsanteTerminale = document.getElementById("buttTerminale");
var pulsanteStorico = document.getElementById("buttStorico");
var pulsanteArmaAllarme = document.getElementById("buttArma");
var pulsanteDisarmaAllarme = document.getElementById("buttDisarma");
var notificationStatus = document.getElementById("notificationStatus");
var notifButton = document.getElementById("notifButt");
var notificheAllarmeArmato = document.getElementById("notificheAllarmeArmato");
var notificheAllarmeDisarmato = document.getElementById("notificheAllarmeDisarmato");
var notificheAllarmeScattato = document.getElementById("notificheAllarmeScattato");
var notificheStatoSeriale = document.getElementById("notificheStatoSeriale");
var htmlStatoAllarme = document.getElementById("alarmStatus");
var distOstacolo = document.getElementById("distOstacolo");
var statoNotifiche = false;
var statoAllarme = null;
var statoPortaSeriale = false;
var selPort = null;
var port = null;

var lastData = null;

const CIAO = "CIAO";
const COMANDO_ARMA_ALLARME = "CAA";
const COMANDO_DISARMA_ALLARME = "CAD";
const ACKNOWLEDGE = "ACK";
const COMANDO_ERRATO = "CE";
const ALLARME_ARMATO = "AA";
const DESC_ALLARME_ARMATO = "Allarme armato";
const ALLARME_DISARMATO = "AD";
const DESC_ALLARME_DISARMATO = "Allarme disarmato";
const ALLARME_SCATTATO_LUCE = "ASL";
const DESC_ALLARME_SCATTATO_LUCE = "Allarme scattato - luce accesa";
const ALLARME_SCATTATO_PORTA = "ASP";
const DESC_ALLARME_SCATTATO_PORTA = "Allarme scattato - porta aperta";
const ALLARME_SCATTATO_OSTACOLO = "ASO";
const DESC_ALLARME_SCATTATO_OSTACOLO = "Allarme scattato - possibile ostacolo rilevato";
const ALLARME_SCATTATO_INFRAROSSI = "ASI";
const DESC_ALLARME_SCATTATO_INFRAROSSI = "Allarme scattato - possibile movimento di un corpo caldo rilevato";
const SENSORE_ULTRASUONI = "SUS";

//  =========================
//      SEZIONE GENERALE
//  =========================

// Gestore degli eventi della pagina web
const sock = {
    events: {},
    on(nomeEvento, listener) {
        if (!this.events[nomeEvento]) {
            this.events[nomeEvento] = [];
        }
        this.events[nomeEvento].push(listener);
    },
    emit(nomeEvento, data) {
        if (this.events[nomeEvento]) {
            this.events[nomeEvento].forEach(listener => listener(data));
        }
    }
};

function impostazioni() {
    UIkit.modal("#impostazioni").show();
}

// Nasconde il pulsante per disconnettere la porta seriale dal browser
document.getElementById("disconnectbutton").style.display = "none";

// Funzione che gestisce il ridimensionamento della finestra del browser
function handleWindowResize() {
    if (window.innerWidth < 550) {
        document.getElementById("top").classList.remove("uk-flex-row");
        document.getElementById("top").classList.add("uk-flex-column");
        document.getElementById("titolo").classList.remove("uk-margin-bottom");
    } else {
        document.getElementById("top").classList.remove("uk-flex-column");
        document.getElementById("top").classList.add("uk-flex-row");
        document.getElementById("titolo").classList.add("uk-margin-bottom");
    }
    if (window.innerWidth < 660) {
        document.getElementById("pulsanti").classList.remove("uk-flex-row");
        document.getElementById("pulsanti").classList.add("uk-flex-column");
    } else {
        document.getElementById("pulsanti").classList.remove("uk-flex-column");
        document.getElementById("pulsanti").classList.add("uk-flex-row");
    }
}

// Evento che chiama la funzione handleWindowResize quando la finestra viene ridimensionata
window.addEventListener("resize", handleWindowResize);

// Effettua il controllo forzato delle dimensioni della finestra una volta caricato lo script
handleWindowResize();

//  ========================
//      SEZIONE STORICO
//  ========================

// Evento che apre la finestra del terminale
pulsanteStorico.addEventListener("click", function() {
    UIkit.modal("#storico").show();
});

function aggiornaTabella(evento) {
    if (storicoTable.rows[0].cells[1].textContent === 'Nessun evento') {
        storicoTable.deleteRow(0);
    }
    var row = storicoTable.insertRow(0);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    cell1.textContent = '0';
    cell2.textContent = evento;
    for (var i = 1; i < storicoTable.rows.length; i++) {
        var cell = storicoTable.rows[i].cells[0];
        cell.textContent = parseInt(cell.textContent) + 1;
    }
}

async function resettaTabella() {
    while (storicoTable.rows.length > 0) {
        storicoTable.deleteRow(0);
    }
    var row = storicoTable.insertRow(0);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    cell1.textContent = '-';
    cell2.textContent = 'Nessun evento';
}

//  =========================
//      SEZIONE TERMINALE
//  =========================

// Evento che apre la finestra del terminale
pulsanteTerminale.addEventListener("click", function() {
    UIkit.modal("#terminale").show();
    rawInput.focus();
    rawInput.select();
    rawData.scrollTop = rawData.scrollHeight;
});

// Funzione che invia i dati inseriti nel campo di testo del terminale
function terminalSendData() {
    if (rawInput.value != "") {
        var data = rawInput.value;
        var encoder = new TextEncoderStream();
        var writableStreamClosed = encoder.readable.pipeTo(port.writable);
        var writer = encoder.writable.getWriter();
        writer.write(data);
        writer.close();
        rawData.value += "\n>> " + data + "\n";
        rawData.scrollTop = rawData.scrollHeight;
        rawInput.value = "";
    }
    rawInput.focus();
    rawInput.select();
}

// Evento che chiama la funzione terminalSendData premendo il tasto Invio
rawInput.addEventListener("keyup", function(event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        terminalSendData();
    }
});

//  =============================
//      SEZIONE PORTA SERIALE
//  =============================

async function leggiDatiDaPorta() {
    var line = "";
    const reader = selPort.readable.getReader();
    sock.on('disconnect', function() {
        try {reader.cancel();}
        catch (error) {}
    });
    try {
        while (statoPortaSeriale) {
            const {value, done} = await reader.read();
            if (done) {
                break;
            }
            
            if (value) {
                var data = new TextDecoder().decode(value);
                var rawData = document.getElementById("rawData");
                rawData.value += data;
                rawData.scrollTop = rawData.scrollHeight;
                if (!(data.includes("\n") || data.includes("\r") || data.includes("\r\n") || data.includes("\n\r"))) {
                    line += data;
                } else {
                    var lines = rawData.value.split('\n');
                    var newLines = lines.filter(function(line) {
                        return line.trim() !== '';
                    });
                    rawData.value = newLines.join('\n');
                    rawData.value += "\n";
                    readData(line);
                    line = "";
                }
            }
        }
    }
    catch (error) {
        console.log(error);
        var notification = UIkit.notification('Si è verificato un errore durante la lettura dei dati dalla porta seriale');
        if (statoNotifiche && notificheStatoSeriale.checked) {
            var notification = new Notification('Allarme: Stato porta seriale', {
                body: "Si è verificato un errore durante la lettura dei dati: " + error,
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 1500);
        }
    }
    finally {
        reader.releaseLock();
        selPort.close();
        selPort = null;
        disconnectSerialDevice();
    }
}

async function chooseSerialDevice() {
    if (!navigator.serial) {
        UIkit.modal("#serialUnavailable").show();
        return;
    }
    try {
        port = await navigator.serial.requestPort();
        var notification = UIkit.notification({
            message: 'Porta seriale selezionata',
            timeout: 500
        });
        document.getElementById("connectbutton").classList.remove("uk-button-default");
        document.getElementById("connectbutton").classList.add("uk-button-primary");
    } catch (error) {
        if (error.name == "NotFoundError") {}
        else if (error.name == "SecurityError") {
            var notification = UIkit.notification('Errore di sicurezza. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore di sicurezza: " + error,
                    requireInteraction: false
                });
                setTimeout(function() {
                    notification.close();
                    notification.close();
                }, 1500);
            }
            console.log("Errore durante la selezione della porta seriale: " + error);
        } else {
            var notification = UIkit.notification('Errore durante la selezione della porta seriale. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore durante la selezione della porta seriale: " + error,
                    requireInteraction: false
                });
                setTimeout(function() {
                    notification.close();
                    notification.close();
                }, 1500);
            }
            console.log("Errore durante la selezione della porta seriale: " + error);
        }
    }
}

async function connectSerialDevice() {
    if (!navigator.serial) {
        UIkit.modal("#serialUnavailable").show();
        return;
    }
    if (port == null) {
        var notification = UIkit.notification({
            message: 'Nessuna porta seriale selezionata',
            timeout: 500
        });
        return;
    }
    try {
        await resettaTabella();
        await port.open({ baudRate: document.getElementById("baudRate").value });
        await disconnectSerialDevice(true);
        selPort = port;
        if (port.readable && port.writable) {
            statoPortaSeriale = true;
            leggiDatiDaPorta();
        }
        var notification = UIkit.notification({
            message: 'Connesso alla porta seriale',
            timeout: 500
        });
        if (statoNotifiche && notificheStatoSeriale.checked) {
            var notification = new Notification('Allarme: Stato porta seriale', {
                body: 'Connesso con successo!',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 1500);
        }
        console.log("Connesso alla porta seriale");
        serialStatus.innerHTML = "Connesso";
        serialStatus.classList.remove("uk-label-danger");
        serialStatus.classList.add("uk-label-success");
        pulsanteTerminale.removeAttribute("disabled");
        sendData(CIAO);
        document.getElementById("disconnectbutton").style.display = "inline-block";
    } catch (error) {
        if (error.name == "NotFoundError") {}
        else if (error.name == "InvalidStateError") {
            if (selPort != null) {
                var notification = UIkit.notification({
                    message: 'Dispositivo già connesso',
                    timeout: 500
                });
                console.log("Dispositivo già connesso " + error);
            }
        } else if (error.name == "NetworkError") {
            var notification = UIkit.notification('La porta seriale è attualmente in uso da un altro programma');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: 'In uso da un altro programma',
                    requireInteraction: false
                });
                setTimeout(function() {
                    notification.close();
                    notification.close();
                }, 1500);
            }
            console.log("Errore durante la connessione alla porta seriale: " + error);
        } else if (error.name == "SecurityError") {
            var notification = UIkit.notification('Errore di sicurezza. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore di sicurezza: " + error,
                    requireInteraction: false
                });
                setTimeout(function() {
                    notification.close();
                    notification.close();
                }, 1500);
            }
            console.log("Errore durante la selezione della porta seriale: " + error);
        } else {
            var notification = UIkit.notification('Errore durante la connessione alla porta seriale. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore durante la connessione alla porta seriale: " + error,
                    requireInteraction: false
                });
                setTimeout(function() {
                    notification.close();
                    notification.close();
                }, 1500);
            }
            console.log("Errore durante la connessione alla porta seriale: " + error);
        }
        
    }
}

async function disconnectSerialDevice(silent = false) {
    statoPortaSeriale = false;
    if (selPort != null) {
        sock.emit("disconnect", null);
        silent = true;
        while (selPort != null) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    pulsanteTerminale.setAttribute("disabled" , "");
    pulsanteArmaAllarme.setAttribute("disabled" , "");
    pulsanteDisarmaAllarme.setAttribute("disabled" , "");
    htmlStatoAllarme.innerHTML = "Non disponibile";
    htmlStatoAllarme.classList.remove("uk-label-success");
    htmlStatoAllarme.classList.remove("uk-label-warning");
    htmlStatoAllarme.classList.remove("uk-label-danger");
    distOstacolo.innerHTML = "Non disponibile";
    rawData.value = "";
    rawInput.value = "";
    serialStatus.innerHTML = "Disconnesso";
    serialStatus.classList.remove("uk-label-success");
    serialStatus.classList.add("uk-label-danger");
    if (!silent) {
        var notification = UIkit.notification({
            message: 'Disconnesso dalla porta seriale',
            timeout: 500
        });
        if (statoNotifiche && notificheStatoSeriale.checked) {
            var notification = new Notification('Allarme: Stato porta seriale', {
                body: 'Disconnesso con successo!',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 1500);
        }
        console.log("Disconnesso dalla porta seriale");
    }
    document.getElementById("disconnectbutton").style.display = "none";
}

function sendData(data) {
    if (data == "\n" || data == "\r" || data == "\r\n" || data == "\n\r"|| data == "") {
        return;
    }
    var encoder = new TextEncoderStream();
    var writableStreamClosed = encoder.readable.pipeTo(selPort.writable);
    var writer = encoder.writable.getWriter();
    writer.write(data);
    writer.close();
    rawData.value += "\n>> " + data + "\n";
    rawData.scrollTop = rawData.scrollHeight;
    rawInput.value = "";
    lastData = data;
    // wait a few seconds and resend the data if no response is received
    setTimeout(function() {
        if (lastData == data && data != ACKNOWLEDGE) {
            sendData(data);
        }
    }, 3000);
}

function readData(data) {
    if (!(data == "\n" || data == "\r" || data == "\r\n" || data == "" || data == ACKNOWLEDGE || data.indexOf(SENSORE_ULTRASUONI) > -1)) {
        sendData(ACKNOWLEDGE);
    }
    if (data == ALLARME_ARMATO) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = "Armato";
        htmlStatoAllarme.classList.add("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.remove("uk-label-danger");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        aggiornaTabella(DESC_ALLARME_ARMATO);
        if (statoNotifiche && notificheAllarmeArmato.checked) {
            var notification = new Notification('Allarme: Stato allarme', {
                body: 'Armato',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 1500);
        }
        var notification = UIkit.notification('Allarme armato');
        console.log("Allarme armato");
    } else if (data == ALLARME_DISARMATO) {
        statoAllarme = false;
        htmlStatoAllarme.innerHTML = "Disarmato";
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.add("uk-label-warning");
        htmlStatoAllarme.classList.remove("uk-label-danger");
        pulsanteDisarmaAllarme.setAttribute("disabled", "");
        pulsanteArmaAllarme.removeAttribute("disabled");
        aggiornaTabella(DESC_ALLARME_DISARMATO);
        if (statoNotifiche && notificheAllarmeArmato.checked) {
            var notification = new Notification('Allarme: Stato allarme', {
                body: 'Disarmato',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 1500);
        }
        var notification = UIkit.notification('Allarme disarmato');
        console.log("Allarme disarmato");
    } else if (data.indexOf(SENSORE_ULTRASUONI) > -1) {
        var distanza = data.substring(SENSORE_ULTRASUONI.length + 1);
        if (distanza > 0 && distanza < 100) {
            distOstacolo.innerHTML = distanza + " cm";
        } else {
            distOstacolo.innerHTML = "Non rilevato";
        }
    } else if (data == ALLARME_SCATTATO_LUCE) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = DESC_ALLARME_SCATTATO_LUCE;
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        aggiornaTabella(DESC_ALLARME_SCATTATO_LUCE);
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'La luce è stata accesa',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 2000);
        }
        var notification = UIkit.notification('Allarme scattato: luce accesa');
        console.log("Allarme scattato: luce accesa");
    } else if (data == ALLARME_SCATTATO_PORTA) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = DESC_ALLARME_SCATTATO_PORTA;
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        aggiornaTabella(DESC_ALLARME_SCATTATO_PORTA);
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'La porta è stata aperta',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 2000);
        }
        var notification = UIkit.notification('Allarme scattato: porta aperta');
        console.log("Allarme scattato: porta aperta");
    } else if (data == ALLARME_SCATTATO_OSTACOLO) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = DESC_ALLARME_SCATTATO_OSTACOLO;
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        aggiornaTabella(DESC_ALLARME_SCATTATO_OSTACOLO);
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'Un ostacolo è stato rilevato',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 2000);
        }
        var notification = UIkit.notification('Allarme scattato: ostacolo rilevato');
        console.log("Allarme scattato: ostacolo rilevato");
    } else if (data == ALLARME_SCATTATO_INFRAROSSI) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = DESC_ALLARME_SCATTATO_INFRAROSSI;
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        aggiornaTabella(DESC_ALLARME_SCATTATO_INFRAROSSI);
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'Infrarossi rilevati',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 2000);
        }
        var notification = UIkit.notification('Allarme scattato: infrarossi rilevato');
        console.log("Allarme scattato: infrarossi rilevato");
    } else if (data == COMANDO_ERRATO) {
        if (statoNotifiche) {
            var notification = new Notification('Allarme: Comando errato', {
                body: 'Il comando inviato non è stato riconosciuto',
                requireInteraction: false
            });
            setTimeout(function() {
                notification.close();
            }, 1500);
        }
        var notification = UIkit.notification({
            message: 'Comando errato',
            timeout: 500
        });
        console.log("Comando errato");
    }
}

// ==========================
//      SEZIONE ALLARME
// ==========================

// funzione che invia il comando di armamento all'allarme
function armaAllarme() {
    if (statoPortaSeriale) {
        if (statoAllarme) {
            var notification = UIkit.notification('Allarme già armato');
        } else {
            pulsanteArmaAllarme.setAttribute("disabled", "");
            pulsanteDisarmaAllarme.setAttribute("disabled", "");
            sendData(COMANDO_ARMA_ALLARME);
        }
    } else {
        var notification = UIkit.notification('Nessuna porta seriale connessa');
    }
}

// funzione che invia il comando di disarmamento all'allarme
function disarmaAllarme() {
    if (statoPortaSeriale) {
        if (!statoAllarme) {
            var notification = UIkit.notification('Allarme già disarmato');
        } else {
            pulsanteArmaAllarme.setAttribute("disabled", "");
            pulsanteDisarmaAllarme.setAttribute("disabled", "");
            sendData(COMANDO_DISARMA_ALLARME);
        }
    } else {
        var notification = UIkit.notification('Nessuna porta seriale connessa');
    }
}

//  =========================
//      SEZIONE NOTIFICHE
//  =========================

// Aggiunta degli eventi che controllano le checkbox e salvano le informazioni all'interno del localStorage

notificheAllarmeArmato.addEventListener("change", function() {
    if (notificheAllarmeArmato.checked) {
        localStorage.setItem("notificheAllarmeArmato", "true");
    } else {
        localStorage.setItem("notificheAllarmeArmato", "false");
    }
});

notificheAllarmeDisarmato.addEventListener("change", function() {
    if (notificheAllarmeDisarmato.checked) {
        localStorage.setItem("notificheAllarmeDisarmato", "true");
    } else {
        localStorage.setItem("notificheAllarmeDisarmato", "false");
    }
});

notificheAllarmeScattato.addEventListener("change", function() {
    if (notificheAllarmeScattato.checked) {
        localStorage.setItem("notificheAllarmeScattato", "true");
    } else {
        localStorage.setItem("notificheAllarmeScattato", "false");
    }
});

notificheStatoSeriale.addEventListener("change", function() {
    if (notificheStatoSeriale.checked) {
        localStorage.setItem("notificheStatoSeriale", "true");
    } else {
        localStorage.setItem("notificheStatoSeriale", "false");
    }
});

// controllo elementi precedentemente salvati nel localStorage e aggiornamento delle checkbox

if (localStorage.getItem("notificheAllarmeArmato") == "true") {
    notificheAllarmeArmato.checked = true;
}
if (localStorage.getItem("notificheAllarmeDisarmato") == "true") {
    notificheAllarmeDisarmato.checked = true;
}
if (localStorage.getItem("notificheAllarmeScattato") == "true") {
    notificheAllarmeScattato.checked = true;
}
if (localStorage.getItem("notificheStatoSeriale") == "true") {
    notificheStatoSeriale.checked = true;
}

if (localStorage.getItem("statoNotifiche") == "true" && Notification.permission === "granted") {
    statoNotifiche = true;
    attivaNotif(silent=true);
} else {
    statoNotifiche = false;
    disattivaNotif(silent=true);
}

// Verifica se la pagina web può inviare notifiche e se le notifiche sono attive e cambia lo stato del label se affermativo
if (Notification.permission === "granted" && statoNotifiche) {
    attivaNotif(silent=true);
} else {
    disattivaNotif(silent=true);
}

// Funzione che gestisce lo stato delle notifiche
function gestioneNotifiche() {
    if (statoNotifiche && Notification.permission === "granted") {
        disattivaNotif();
    } else if (!statoNotifiche && Notification.permission === "granted") {
        attivaNotif();
    } else {
        if (Notification.permission === "granted") {
            attivaNotif(silent=true);
        } else {
            UIkit.modal("#enableNotif").show();
            Notification.requestPermission().then(function(result) {
                if (result === 'granted') {
                    attivaNotif();
                    notificheAllarmeArmato.checked = true;
                    localStorage.setItem("notificheAllarmeArmato", "true");
                    notificheAllarmeDisarmato.checked = true;
                    localStorage.setItem("notificheAllarmeDisarmato", "true");
                    notificheAllarmeScattato.checked = true;
                    localStorage.setItem("notificheAllarmeScattato", "true");
                    notificheStatoSeriale.checked = true;
                    localStorage.setItem("notificheStatoSeriale", "true");
                } else {
                    UIkit.modal("#enableNotif").hide();
                    var notification = UIkit.notification('Notifiche non abilitate');
                }
            });
        }
    }
}

function attivaNotif(silent = false) {
    statoNotifiche = true;
    localStorage.setItem("statoNotifiche", "true");
    notificationStatus.innerHTML = "Attivate";
    notificationStatus.classList.remove("uk-label-danger");
    notificationStatus.classList.add("uk-label-success");
    notifButton.title = "Disattiva notifiche";
    notifButton.innerHTML = "Disattiva notifiche";
    notifButton.classList.remove("uk-button-secondary");
    notifButton.classList.add("uk-button-default");
    notificheAllarmeArmato.removeAttribute("disabled");
    notificheAllarmeDisarmato.removeAttribute("disabled");
    notificheAllarmeScattato.removeAttribute("disabled");
    notificheStatoSeriale.removeAttribute("disabled");
    UIkit.modal("#enableNotif").hide();
    if (!silent) {
        var notification = UIkit.notification('Notifiche abilitate');
    }
}

function disattivaNotif(silent = false) {
    statoNotifiche = false;
    localStorage.setItem("statoNotifiche", "false");
    notificationStatus.innerHTML = "Disattivate";
    notificationStatus.classList.remove("uk-label-success");
    notificationStatus.classList.add("uk-label-danger");
    notifButton.title = "Attiva notifiche";
    notifButton.innerHTML = "Attiva notifiche";
    notifButton.classList.remove("uk-button-default");
    notifButton.classList.add("uk-button-secondary");
    notificheAllarmeArmato.setAttribute("disabled", "");
    notificheAllarmeDisarmato.setAttribute("disabled", "");
    notificheAllarmeScattato.setAttribute("disabled", "");
    notificheStatoSeriale.setAttribute("disabled", "");
    if (!silent) {
        var notification = UIkit.notification('Notifiche disabilitate');
    }
}