export const getTahunPelajaran = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 7) {
    return `Tahun Pelajaran ${year}/${year + 1} Semester Ganjil`;
  } else {
    return `Tahun Pelajaran ${year - 1}/${year} Semester Genap`;
  }
};

export const formatTimeShort = (timeStr) => {
  if (!timeStr || timeStr === '-') return '-';
  const match = timeStr.match(/\d{2}[:.]\d{2}/);
  if (match) return match[0].replace(/\./g, ':');
  return timeStr;
};

export const getTodayDate = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
};

