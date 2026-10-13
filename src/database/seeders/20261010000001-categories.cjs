"use strict";

const now = new Date();

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("categories", [
      { name: "Pekerjaan", description: "Tugas dan aktivitas kerja", is_active: true, created_at: now },
      { name: "Belajar", description: "Kursus, membaca, dan latihan skill", is_active: true, created_at: now },
      { name: "Proyek Pribadi", description: "Side project dan eksplorasi", is_active: true, created_at: now },
      { name: "Kesehatan", description: "Olahraga dan kebiasaan sehat", is_active: true, created_at: now },
      { name: "Lainnya", description: "Aktivitas di luar kategori lain", is_active: true, created_at: now },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("categories", null, {});
  },
};