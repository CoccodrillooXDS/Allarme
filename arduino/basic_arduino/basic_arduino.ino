#include <LiquidCrystal.h>
LiquidCrystal lcd(6, 7, 8, 9, 10, 11);

#define pinLed 4
#define pinPorta 2
#define pinBuzzer 3
#define pinPulsanteAllarme 5
#define pinFotoresistenza A0

bool allarmeArmato = false;
bool statoPulsanteAllarmePrecedente = false;
bool allarmeFotoresistenza = false;
bool allarmePulsanteMeccanico = false;

#define soglia 40

void setup(){
  pinMode(pinPorta, INPUT_PULLUP);
  pinMode(pinPulsanteAllarme, INPUT_PULLUP);
  pinMode(pinFotoresistenza, INPUT_PULLUP);
  pinMode(pinBuzzer, OUTPUT);
  pinMode(pinLed, OUTPUT);
  lcd.begin(16, 2);
  Serial.begin(9600);
  disarmaAllarme();
}

void loop(){
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
  if ((allarmeFotoresistenza || allarmePulsanteMeccanico) && allarmeArmato)
    attivaAllarme();
  delay(400);
}

void attivaAllarme(){
  bool statoPulsanteAllarme = false;
  lcd.clear();
  lcd.setCursor(4, 0);
  lcd.print("ALLARME:");
  if (allarmeFotoresistenza) {
    lcd.setCursor(6, 1);
    lcd.print("LUCE");
    Serial.println("Allarme Scattato da luce!");
  } else {
    lcd.setCursor(5, 1);
    lcd.print("PORTA");
    Serial.println("Allarme Scattato da porta!");
  }
  for (int i = 0; i < 20; i++) {
    delay(200);
    digitalWrite(pinLed, HIGH);
    tone(pinBuzzer, 1000);
    delay(400);
    digitalWrite(pinLed, LOW);
    noTone(pinBuzzer);
    statoPulsanteAllarme = digitalRead(pinPulsanteAllarme);
    if (!statoPulsanteAllarme) {
      disarmaAllarme();
      break;
    }
  }
}

void armaAllarme(){
  allarmeArmato = true;
  lcd.clear();
  lcd.setCursor(4, 0);
  lcd.print("ALLARME:");
  lcd.setCursor(5,1);
  lcd.print("ARMATO");
  Serial.println("Allarme Armato");
  delay(500);
}

void disarmaAllarme(){
  allarmeArmato = false;
  lcd.clear();
  lcd.setCursor(4, 0);
  lcd.print("ALLARME:");
  lcd.setCursor(3,1);
  lcd.print("DISARMATO");
  Serial.println("Allarme Disarmato");
  delay(500);
}
