#include <LiquidCrystal.h>
LiquidCrystal lcd(6, 7, 8, 9, 10, 11);

#define pinLed 4
#define pinPorta 2
#define pinBuzzer 3
#define pinPulsanteAllarme 5
#define trigPin 12
#define echoPin 13
#define pinFotoresistenza A0
#define pirPin A1

long durata;
int distanza;
int valPir;

bool allarmeArmato = false;
bool interrompiAllarme = false;
bool allarmeScattato = false;
bool statoPulsanteAllarmePrecedente = false;
bool allarmeFotoresistenza = false;
bool allarmePulsanteMeccanico = false;
bool allarmeOstacolo = false;
bool allarmeInfrarossi = false;

const String CIAO = "CIAO";
const String COMANDO_ARMA_ALLARME = "CAA";
const String COMANDO_DISARMA_ALLARME = "CAD";
const String ACKNOWLEDGE = "ACK";
const String COMANDO_ERRATO = "CE";
const String ALLARME_ARMATO = "AA";
const String ALLARME_DISARMATO = "AD";
const String ALLARME_SCATTATO_LUCE = "ASL";
const String ALLARME_SCATTATO_PORTA = "ASP";
const String ALLARME_SCATTATO_OSTACOLO = "ASO";
const String ALLARME_SCATTATO_INFRAROSSI = "ASI";
const String SENSORE_ULTRASUONI = "SUS";

#define soglia 60

void setup(){
  pinMode(pinPorta, INPUT_PULLUP);
  pinMode(pinPulsanteAllarme, INPUT_PULLUP);
  pinMode(pinFotoresistenza, INPUT_PULLUP);
  pinMode(pinBuzzer, OUTPUT);
  pinMode(pinLed, OUTPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(pirPin, INPUT);
  lcd.begin(16, 2);
  Serial.begin(9600);
  delay(500);
  disarmaAllarme();
}

void loop(){
  int lastSent = 0;
  distanza = calcolaDistanza();
  if (millis() - lastSent > 2000) {
    lastSent = millis();
    Serial.println(SENSORE_ULTRASUONI + "," + String(distanza));
  }
  valPir = digitalRead(pirPin);
  leggiStringaDaSerial();
  bool statoPulsanteAllarme = digitalRead(pinPulsanteAllarme);
  if (!statoPulsanteAllarme){
    allarmeArmato = !allarmeArmato;
    if (allarmeArmato && !statoPulsanteAllarmePrecedente) {
      armaAllarme();
    } else if (!allarmeArmato && !statoPulsanteAllarmePrecedente) {
      disarmaAllarme();
    }
  }
  int valoreFotoresistenza = analogRead(pinFotoresistenza);
  bool statoPulsateMeccanico = digitalRead(pinPorta);
  if (valoreFotoresistenza < soglia)
    allarmeFotoresistenza = true;
  else
    allarmeFotoresistenza = false;
  if (!statoPulsateMeccanico)
    allarmePulsanteMeccanico = true;
  else
    allarmePulsanteMeccanico = false;
  if (distanza < 20)
    allarmeOstacolo = true;
  else
    allarmeOstacolo = false;
  if (valPir == HIGH)
    allarmeInfrarossi = true;
  else
    allarmeInfrarossi = false;
  if ((allarmeFotoresistenza || allarmePulsanteMeccanico || allarmeInfrarossi || allarmeOstacolo) && allarmeArmato) {
    interrompiAllarme = false;
    attivaAllarme();
  }
  delay(400);
}

void attivaAllarme(){
  bool statoPulsanteAllarme = false;
  allarmeScattato = true;
  lcd.clear();
  lcd.setCursor(4, 0);
  lcd.print("ALLARME:");
  if (allarmeFotoresistenza) {
    lcd.setCursor(6, 1);
    lcd.print("LUCE");
    Serial.println(ALLARME_SCATTATO_LUCE);
  } else if (allarmePulsanteMeccanico) {
    lcd.setCursor(5, 1);
    lcd.print("PORTA");
    Serial.println(ALLARME_SCATTATO_PORTA);
  } else if (allarmeOstacolo) {
    lcd.setCursor(4, 1);
    lcd.print("OSTACOLO");
    Serial.println(ALLARME_SCATTATO_OSTACOLO);
  } else if (allarmeInfrarossi) {
    lcd.setCursor(3, 1);
    lcd.print("INFRAROSSI");
    Serial.println(ALLARME_SCATTATO_INFRAROSSI);
  } else {
    disarmaAllarme();
    return;
  }
  for (int i = 0; i < 20; i++) {
    digitalWrite(pinLed, HIGH);
    tone(pinBuzzer, 1000);
    statoPulsanteAllarme = digitalRead(pinPulsanteAllarme);
    leggiStringaLite();
    if (!statoPulsanteAllarme || interrompiAllarme) {
      disarmaAllarme();
      break;
    }
    digitalWrite(pinLed, LOW);
    noTone(pinBuzzer);
    if (!statoPulsanteAllarme || interrompiAllarme) {
      disarmaAllarme();
      break;
    }
    delay(100);
    digitalWrite(pinLed, HIGH);
    tone(pinBuzzer, 1500);
    statoPulsanteAllarme = digitalRead(pinPulsanteAllarme);
    leggiStringaLite();
    if (!statoPulsanteAllarme || interrompiAllarme) {
      disarmaAllarme();
      break;
    }
    digitalWrite(pinLed, LOW);
    noTone(pinBuzzer);
    delay(100);
    if (!statoPulsanteAllarme || interrompiAllarme) {
      disarmaAllarme();
      break;
    }
  }
}

void armaAllarme(){
  allarmeArmato = true;
  allarmeScattato = false;
  interrompiAllarme = false;
  lcd.clear();
  lcd.setCursor(4, 0);
  lcd.print("ALLARME:");
  lcd.setCursor(5,1);
  lcd.print("ARMATO");
  Serial.println(ALLARME_ARMATO);
  delay(500);
}

void disarmaAllarme(){
  allarmeArmato = false;
  allarmeScattato = false;
  interrompiAllarme = true;
  digitalWrite(pinLed, LOW);
  noTone(pinBuzzer);
  lcd.clear();
  lcd.setCursor(4, 0);
  lcd.print("ALLARME:");
  lcd.setCursor(3,1);
  lcd.print("DISARMATO");
  Serial.println(ALLARME_DISARMATO);
  delay(500);
}

void leggiStringaLite(){
  String stringa = "";
  stringa = Serial.readStringUntil('\r\n');
  if (stringa == COMANDO_DISARMA_ALLARME) {
    Serial.println(ACKNOWLEDGE);
    interrompiAllarme = true;
    delay(500);
    return;
  } else if (stringa == COMANDO_ERRATO) {
    Serial.println(ACKNOWLEDGE);
    delay(500);
    return;
  } else if (stringa == ACKNOWLEDGE) {
    return;
  }
}

void leggiStringaDaSerial(){
  String stringa = "";
  stringa = Serial.readStringUntil('\r\n');
  if (stringa == CIAO) {
    if (!allarmeArmato)
      Serial.println(ALLARME_DISARMATO);
    else
      Serial.println(ALLARME_ARMATO);
  } else if (stringa == COMANDO_ARMA_ALLARME) {
    Serial.println(ACKNOWLEDGE);
    delay(500);
    armaAllarme();
  } else if (stringa == COMANDO_DISARMA_ALLARME) {
    Serial.println(ACKNOWLEDGE);
    delay(500);
    if (allarmeScattato)
      interrompiAllarme = true;
    else
      disarmaAllarme();
  } else if (stringa == COMANDO_ERRATO) {
    Serial.println(ACKNOWLEDGE);
  }
  delay(500);
}

int calcolaDistanza(){ 
  digitalWrite(trigPin, LOW); 
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH); 
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  durata = pulseIn(echoPin, HIGH);
  distanza = durata*0.034/2;
  return distanza;
}
