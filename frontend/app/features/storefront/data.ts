/* circuit.rocks homepage — content data (ported verbatim from the UI kit). */

export type Product = {
  title: string;
  sku: string;
  price: string;
  imageLabel: string;
  stock: number;
};

export const FEATURED: Product[] = [
  { title: "Raspberry Pi 5 Quad-Core Cortex-A76 4GB", sku: "2331", price: "₱ 5,915.00", imageLabel: "rpi5.jpg", stock: 12 },
  { title: "Raspberry Pi 27W USB-C Power Supply", sku: "2402", price: "₱ 1,542.00", imageLabel: "rpi-psu.jpg", stock: 40 },
  { title: "Raspberry Pi 5 Active Cooler", sku: "2410", price: "₱ 1,418.00", imageLabel: "active-cooler.jpg", stock: 33 },
  { title: "Raspberry Pi 5 Case (Red/White)", sku: "2415", price: "₱ 1,149.00", imageLabel: "rpi5-case.jpg", stock: 21 },
];

export const MOVERS: Product[] = [
  { title: "Arduino UNO R3 (CH340)", sku: "2507", price: "₱ 255.00", imageLabel: "uno-ch340.jpg", stock: 80 },
  { title: "Arduino UNO R3 (ATmega328)", sku: "2510", price: "₱ 315.00", imageLabel: "uno-atmega.jpg", stock: 90 },
  { title: "ESP32 Dev Board WROOM-32", sku: "3110", price: "₱ 355.00", imageLabel: "esp32.jpg", stock: 88 },
  { title: "Arduino Nano V3 (CH340)", sku: "2520", price: "₱ 227.00", imageLabel: "nano-v3.jpg", stock: 78 },
  { title: "NodeMCU ESP8266 CP2102", sku: "3050", price: "₱ 225.00", imageLabel: "nodemcu.jpg", stock: 99 },
  { title: "Arduino Mega 2560 R3 (CH340)", sku: "2099", price: "₱ 745.00", imageLabel: "mega-ch340.jpg", stock: 6 },
  { title: "Arduino Mega 2560 R3 (genuine)", sku: "2100", price: "₱ 1,490.00", imageLabel: "mega-genuine.jpg", stock: 0 },
  { title: "Arduino Nano V3 (unsoldered)", sku: "2521", price: "₱ 149.00", imageLabel: "nano-uns.jpg", stock: 150 },
];

export const BRANDS = [
  { brand: "Adafruit", count: 107 },
  { brand: "DFRobot", count: 67 },
  { brand: "Raspberry Pi", count: 68 },
  { brand: "Pololu", count: 124 },
  { brand: "SparkFun", count: 37 },
  { brand: "Seeed", count: 19 },
  { brand: "Arduino", count: 14 },
  { brand: "Waveshare", count: 9 },
];

export const EVENTS = [
  { month: "MAY", day: "24", title: "ESP32 Wi-Fi Workshop", location: "Quezon City", time: "2:00 PM" },
  { month: "JUN", day: "07", title: "Raspberry Pi Meetup", location: "Makati", time: "6:00 PM" },
  { month: "JUN", day: "14", title: "Solder Clinic", location: "Manila", time: "1:00 PM" },
  { month: "JUN", day: "21", title: "Jetson AI Livestream", location: "Online", time: "8:00 PM" },
];

export const PROPS = [
  {
    label: "// sourced direct",
    title: "No relabeling, no clones-as-genuine",
    body: "Parts come straight from Adafruit, DFRobot, Arduino and friends. What the listing says is what ships.",
  },
  {
    label: "// real support",
    title: "Help that knows your part",
    body: "Questions answered by people who actually build. Datasheets, pinouts and wiring — not a script.",
  },
  {
    label: "// manila stock",
    title: "Same-day cutoff 4PM",
    body: "Physically in Manila. Order before 16:00 PHT and it ships today via J&T. Provincial in 1–3 days.",
  },
];

export const MEGA: Record<string, string[]> = {
  Boards: ["Raspberry Pi", "Arduino", "ESP32 / ESP8266", "Microcontrollers", "Single-board computers"],
  Sensors: ["Temperature", "Motion / IMU", "Distance", "Light / Color", "Fingerprint"],
  Kits: ["Starter kits", "STEM / classroom", "Robotics", "IoT"],
  Learn: ["Tutorials", "Build log", "Forum", "Events"],
};
