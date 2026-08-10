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
