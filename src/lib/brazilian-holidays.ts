/**
 * Feriados e datas comemorativas brasileiras
 * Usado no calendário de mídias para ajudar na criação de conteúdo
 */

export interface BrazilianHoliday {
  date: string; // formato MM-DD
  name: string;
  type: "national" | "commemorative" | "commercial";
  emoji: string;
  description?: string;
}

// Feriados nacionais e datas comemorativas fixas
export const BRAZILIAN_HOLIDAYS: BrazilianHoliday[] = [
  // Janeiro
  { date: "01-01", name: "Ano Novo", type: "national", emoji: "🎆" },
  { date: "01-25", name: "Aniversário de São Paulo", type: "commemorative", emoji: "🏙️" },
  
  // Fevereiro (Carnaval é móvel, calculado separadamente)
  { date: "02-14", name: "Valentine's Day (EUA)", type: "commercial", emoji: "💕" },
  
  // Março
  { date: "03-08", name: "Dia da Mulher", type: "commemorative", emoji: "💜" },
  { date: "03-15", name: "Dia do Consumidor", type: "commercial", emoji: "🛒" },
  { date: "03-20", name: "Início do Outono", type: "commemorative", emoji: "🍂" },
  
  // Abril
  { date: "04-19", name: "Dia do Índio", type: "commemorative", emoji: "🪶" },
  { date: "04-21", name: "Tiradentes", type: "national", emoji: "🇧🇷" },
  { date: "04-22", name: "Descobrimento do Brasil", type: "commemorative", emoji: "⛵" },
  
  // Maio
  { date: "05-01", name: "Dia do Trabalho", type: "national", emoji: "👷" },
  { date: "05-13", name: "Abolição da Escravatura", type: "commemorative", emoji: "⛓️" },
  // Dia das Mães é móvel (2º domingo de maio)
  
  // Junho
  { date: "06-12", name: "Dia dos Namorados", type: "commercial", emoji: "❤️" },
  { date: "06-21", name: "Início do Inverno", type: "commemorative", emoji: "❄️" },
  { date: "06-24", name: "São João", type: "commemorative", emoji: "🔥" },
  
  // Julho
  { date: "07-26", name: "Dia dos Avós", type: "commemorative", emoji: "👴👵" },
  
  // Agosto
  // Dia dos Pais é móvel (2º domingo de agosto)
  { date: "08-11", name: "Dia do Estudante", type: "commemorative", emoji: "📚" },
  { date: "08-22", name: "Dia do Folclore", type: "commemorative", emoji: "🎭" },
  { date: "08-25", name: "Dia do Soldado", type: "commemorative", emoji: "🪖" },
  
  // Setembro
  { date: "09-07", name: "Independência do Brasil", type: "national", emoji: "🇧🇷" },
  { date: "09-21", name: "Dia da Árvore", type: "commemorative", emoji: "🌳" },
  { date: "09-22", name: "Início da Primavera", type: "commemorative", emoji: "🌸" },
  
  // Outubro
  { date: "10-12", name: "Dia das Crianças / N.S. Aparecida", type: "national", emoji: "🧒" },
  { date: "10-15", name: "Dia do Professor", type: "commemorative", emoji: "📖" },
  { date: "10-31", name: "Halloween", type: "commercial", emoji: "🎃" },
  
  // Novembro
  { date: "11-02", name: "Finados", type: "national", emoji: "🕯️" },
  { date: "11-15", name: "Proclamação da República", type: "national", emoji: "🇧🇷" },
  { date: "11-20", name: "Consciência Negra", type: "commemorative", emoji: "✊🏿" },
  // Black Friday é móvel (4ª sexta de novembro)
  
  // Dezembro
  { date: "12-21", name: "Início do Verão", type: "commemorative", emoji: "☀️" },
  { date: "12-24", name: "Véspera de Natal", type: "commemorative", emoji: "🎄" },
  { date: "12-25", name: "Natal", type: "national", emoji: "🎅" },
  { date: "12-31", name: "Véspera de Ano Novo", type: "commemorative", emoji: "🎊" },
];

/**
 * Calcula a data da Páscoa usando o algoritmo de Butcher-Meeus
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Retorna o N-ésimo domingo de um mês
 */
function getNthSunday(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstSunday = new Date(year, month, 1 + (7 - firstDay.getDay()) % 7);
  return new Date(year, month, firstSunday.getDate() + (n - 1) * 7);
}

/**
 * Retorna a N-ésima sexta-feira de um mês
 */
function getNthFriday(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  let firstFriday = 1 + (5 - firstDay.getDay() + 7) % 7;
  if (firstFriday > 7) firstFriday -= 7;
  return new Date(year, month, firstFriday + (n - 1) * 7);
}

/**
 * Retorna os feriados móveis para um ano específico
 */
export function getMovableHolidays(year: number): Array<{ date: Date; name: string; emoji: string; type: "national" | "commemorative" | "commercial" }> {
  const easter = calculateEaster(year);
  const holidays: Array<{ date: Date; name: string; emoji: string; type: "national" | "commemorative" | "commercial" }> = [];

  // Carnaval (47 dias antes da Páscoa - terça-feira)
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays.push({ date: carnival, name: "Carnaval", emoji: "🎭", type: "national" });

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({ date: goodFriday, name: "Sexta-feira Santa", emoji: "✝️", type: "national" });

  // Páscoa
  holidays.push({ date: easter, name: "Páscoa", emoji: "🐰", type: "national" });

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push({ date: corpusChristi, name: "Corpus Christi", emoji: "⛪", type: "national" });

  // Dia das Mães (2º domingo de maio)
  const mothersDay = getNthSunday(year, 4, 2); // Maio = 4 (0-indexed)
  holidays.push({ date: mothersDay, name: "Dia das Mães", emoji: "💐", type: "commercial" });

  // Dia dos Pais (2º domingo de agosto)
  const fathersDay = getNthSunday(year, 7, 2); // Agosto = 7 (0-indexed)
  holidays.push({ date: fathersDay, name: "Dia dos Pais", emoji: "👔", type: "commercial" });

  // Black Friday (4ª sexta-feira de novembro)
  const blackFriday = getNthFriday(year, 10, 4); // Novembro = 10 (0-indexed)
  holidays.push({ date: blackFriday, name: "Black Friday", emoji: "🏷️", type: "commercial" });

  // Cyber Monday (segunda após Black Friday)
  const cyberMonday = new Date(blackFriday);
  cyberMonday.setDate(blackFriday.getDate() + 3);
  holidays.push({ date: cyberMonday, name: "Cyber Monday", emoji: "💻", type: "commercial" });

  return holidays;
}

/**
 * Verifica se uma data é feriado ou data comemorativa
 * Retorna null se não for, ou os dados da data comemorativa se for
 */
export function getHolidayForDate(date: Date): BrazilianHoliday | null {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  
  // Verifica feriados fixos
  const fixedHoliday = BRAZILIAN_HOLIDAYS.find(h => h.date === monthDay);
  if (fixedHoliday) {
    return fixedHoliday;
  }

  // Verifica feriados móveis
  const year = date.getFullYear();
  const movableHolidays = getMovableHolidays(year);
  const movable = movableHolidays.find(h => 
    h.date.getFullYear() === date.getFullYear() &&
    h.date.getMonth() === date.getMonth() &&
    h.date.getDate() === date.getDate()
  );

  if (movable) {
    return {
      date: monthDay,
      name: movable.name,
      type: movable.type,
      emoji: movable.emoji,
    };
  }

  return null;
}

/**
 * Retorna todos os feriados de um mês específico
 */
export function getHolidaysForMonth(year: number, month: number): Array<{ day: number; holiday: BrazilianHoliday }> {
  const result: Array<{ day: number; holiday: BrazilianHoliday }> = [];
  const monthStr = String(month + 1).padStart(2, "0");

  // Feriados fixos do mês
  BRAZILIAN_HOLIDAYS.forEach(holiday => {
    if (holiday.date.startsWith(monthStr + "-")) {
      const day = parseInt(holiday.date.split("-")[1], 10);
      result.push({ day, holiday });
    }
  });

  // Feriados móveis do mês
  const movableHolidays = getMovableHolidays(year);
  movableHolidays.forEach(movable => {
    if (movable.date.getMonth() === month) {
      result.push({
        day: movable.date.getDate(),
        holiday: {
          date: `${monthStr}-${String(movable.date.getDate()).padStart(2, "0")}`,
          name: movable.name,
          type: movable.type,
          emoji: movable.emoji,
        }
      });
    }
  });

  return result.sort((a, b) => a.day - b.day);
}
