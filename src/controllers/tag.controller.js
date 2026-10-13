import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

export const list = async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      `SELECT t.id, t.name, COUNT(at.activity_id)::int AS count
         FROM tags t LEFT JOIN activity_tags at ON at.tag_id = t.id
        WHERE t.user_id = :uid
        GROUP BY t.id ORDER BY count DESC, t.name`,
      { replacements: { uid: req.user.id }, type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (e) { next(e); }
};