const rawData = document.getElementById("rawData");
const rawInput = document.getElementById("rawInput");

var pulsanteTerminale = document.getElementById("buttTerminale");
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
const ALLARME_DISARMATO = "AD";
const ALLARME_SCATTATO_LUCE = "ASL";
const ALLARME_SCATTATO_PORTA = "ASP";
const ALLARME_SCATTATO_OSTACOLO = "ASO";
const ALLARME_SCATTATO_INFRAROSSI = "ASI";
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

//  =========================
//      SEZIONE TERMINALE
//  =========================

// Evento che apre la finestra del terminale
pulsanteTerminale.addEventListener("click", function() {
    UIkit.modal("#terminale").show();
    rawInput.focus();
    rawInput.select();
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
                body: "Si è verificato un errore durante la lettura dei dati: " + error
            });
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
    //if (!navigator.serial) {
    //    UIkit.modal("#serialUnavailable").show();
    //    return;
    //}
    try {
        port = await navigator.serial.requestPort();
        var notification = UIkit.notification('Porta seriale selezionata');
        document.getElementById("connectbutton").classList.remove("uk-button-default");
        document.getElementById("connectbutton").classList.add("uk-button-primary");
    } catch (error) {
        if (error.name == "NotFoundError") {}
        else if (error.name == "SecurityError") {
            var notification = UIkit.notification('Errore di sicurezza. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore di sicurezza: " + error
                });
            }
            console.log("Errore durante la selezione della porta seriale: " + error);
        } else {
            var notification = UIkit.notification('Errore durante la selezione della porta seriale. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore durante la selezione della porta seriale: " + error
                });
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
        var notification = UIkit.notification('Nessuna porta seriale selezionata');
        return;
    }
    try {
        await port.open({ baudRate: document.getElementById("baudRate").value });
        await disconnectSerialDevice(true);
        selPort = port;
        if (port.readable && port.writable) {
            statoPortaSeriale = true;
            leggiDatiDaPorta();
        }
        var notification = UIkit.notification('Connesso alla porta seriale');
        if (statoNotifiche && notificheStatoSeriale.checked) {
            var notification = new Notification('Allarme: Stato porta seriale', {
                body: 'Connesso con successo!'
            });
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
                var notification = UIkit.notification('Dispositivo già connesso');
                console.log("Dispositivo già connesso " + error);
            }
        } else if (error.name == "NetworkError") {
            var notification = UIkit.notification('La porta seriale è attualmente in uso da un altro programma');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: 'In uso da un altro programma'
                });
            }
            console.log("Errore durante la connessione alla porta seriale: " + error);
        } else if (error.name == "SecurityError") {
            var notification = UIkit.notification('Errore di sicurezza. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore di sicurezza: " + error
                });
            }
            console.log("Errore durante la selezione della porta seriale: " + error);
        } else {
            var notification = UIkit.notification('Errore nella connessione alla porta seriale. Controlla la console per maggiori informazioni');
            if (statoNotifiche && notificheStatoSeriale.checked) {
                var notification = new Notification('Allarme: Stato porta seriale', {
                    body: "Si è verificato un errore durante la connessione alla porta seriale: " + error
                });
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
        var notification = UIkit.notification('Disconnesso dalla porta seriale');
        if (statoNotifiche && notificheStatoSeriale.checked) {
            var notification = new Notification('Allarme: Stato porta seriale', {
                body: 'Disconnesso con successo!'
            });
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
        if (statoNotifiche && notificheAllarmeArmato.checked) {
            var notification = new Notification('Allarme: Stato allarme', {
                body: 'Armato'
            });
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
        if (statoNotifiche && notificheAllarmeArmato.checked) {
            var notification = new Notification('Allarme: Stato allarme', {
                body: 'Disarmato'
            });
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
        htmlStatoAllarme.innerHTML = "Allarme scattato - Luce accesa";
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'La luce è stata accesa'
            });
        }
        var notification = UIkit.notification('Allarme scattato: luce accesa');
        console.log("Allarme scattato: luce accesa");
    } else if (data == ALLARME_SCATTATO_PORTA) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = "Allarme scattato - Porta aperta";
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'La porta è stata aperta'
            });
        }
        var notification = UIkit.notification('Allarme scattato: porta aperta');
        console.log("Allarme scattato: porta aperta");
    } else if (data == ALLARME_SCATTATO_OSTACOLO) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = "Allarme scattato - Ostacolo rilevato";
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'Un ostacolo è stato rilevato'
            });
        }
        var notification = UIkit.notification('Allarme scattato: ostacolo rilevato');
        console.log("Allarme scattato: ostacolo rilevato");
    } else if (data == ALLARME_SCATTATO_INFRAROSSI) {
        statoAllarme = true;
        htmlStatoAllarme.innerHTML = "Allarme scattato - Infrarossi rilevato";
        htmlStatoAllarme.classList.remove("uk-label-success");
        htmlStatoAllarme.classList.remove("uk-label-warning");
        htmlStatoAllarme.classList.add("uk-label-danger");
        pulsanteArmaAllarme.setAttribute("disabled", "");
        pulsanteDisarmaAllarme.removeAttribute("disabled");
        if (statoNotifiche && notificheAllarmeScattato.checked) {
            var notification = new Notification('Allarme: Movimento rilevato', {
                body: 'Infrarossi rilevati'
            });
        }
        var notification = UIkit.notification('Allarme scattato: infrarossi rilevato');
        console.log("Allarme scattato: infrarossi rilevato");
    } else if (data == COMANDO_ERRATO) {
        if (statoNotifiche) {
            var notification = new Notification('Allarme: Comando errato', {
                body: 'Il comando inviato non è stato riconosciuto'
            });
        }
        var notification = UIkit.notification('Comando errato');
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