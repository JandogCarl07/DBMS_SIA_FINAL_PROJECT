const { pool } = require('../config/db');
const { HttpError, buildData } = require('../utils/helpers');

function createCrudModel(cfg) {
  const base = cfg.select || `SELECT t.* FROM ${cfg.table} t`;
  const pk = `t.${cfg.pk}`;

  async function getWith(db, id) {
    const [rows] = await db.query(`${base} WHERE ${pk} = ?`, [id]);
    return rows[0] || null;
  }

  const model = {
    cfg,

    async list(q = {}) {
      const where = [], params = [];
      for (const f of cfg.filters || []) if (q[f] !== undefined && q[f] !== '') { where.push(`t.${f} = ?`); params.push(q[f]); }
      if (q.q && cfg.search?.length) {
        where.push('(' + cfg.search.map(c => `${c.includes('.') ? c : 't.' + c} LIKE ?`).join(' OR ') + ')');
        cfg.search.forEach(() => params.push(`%${q.q}%`));
      }
      if (cfg.customFilters) cfg.customFilters(q, where, params);
      const sql = `${base}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${cfg.order || pk}`;
      const [rows] = await pool.query(sql, params);
      return rows;
    },

    async get(id) {
      const row = await getWith(pool, id);
      if (!row) throw new HttpError(404, `${cfg.label || cfg.table} #${id} not found`);
      return row;
    },

    async create(body, user) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const data = buildData(body, cfg, false);
        const ctx = { conn, user, body, isCreate: true };
        if (cfg.hooks?.beforeSave) await cfg.hooks.beforeSave(data, ctx);
        const [res] = await conn.query(`INSERT INTO ${cfg.table} SET ?`, [data]);
        const row = await getWith(conn, res.insertId);
        if (cfg.hooks?.afterSave) await cfg.hooks.afterSave(conn, row, ctx);
        await conn.commit();
        return await getWith(pool, res.insertId);
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    },

    async update(id, body, user) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[existing]] = await conn.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.pk} = ? FOR UPDATE`, [id]);
        if (!existing) throw new HttpError(404, `${cfg.label || cfg.table} #${id} not found`);
        const data = buildData(body, cfg, true);
        const ctx = { conn, user, body, isCreate: false, existing };
        if (cfg.hooks?.beforeSave) await cfg.hooks.beforeSave(data, ctx);
        if (!Object.keys(data).length) throw new HttpError(400, 'No valid fields to update');
        await conn.query(`UPDATE ${cfg.table} SET ? WHERE ${cfg.pk} = ?`, [data, id]);
        const row = await getWith(conn, id);
        if (cfg.hooks?.afterSave) await cfg.hooks.afterSave(conn, row, ctx);
        await conn.commit();
        return await getWith(pool, id);
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    },

    async remove(id, user) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[existing]] = await conn.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.pk} = ? FOR UPDATE`, [id]);
        if (!existing) throw new HttpError(404, `${cfg.label || cfg.table} #${id} not found`);
        if (cfg.hooks?.beforeDelete) await cfg.hooks.beforeDelete(existing, { conn, user });
        let result;
        if (cfg.softDelete) {
          await conn.query(`UPDATE ${cfg.table} SET ${cfg.softDelete.col} = ? WHERE ${cfg.pk} = ?`, [cfg.softDelete.value, id]);
          result = { id, deleted: false, message: `${cfg.label || cfg.table} #${id} set to ${cfg.softDelete.value}` };
        } else {
          await conn.query(`DELETE FROM ${cfg.table} WHERE ${cfg.pk} = ?`, [id]);
          result = { id, deleted: true, message: `${cfg.label || cfg.table} #${id} deleted` };
        }
        await conn.commit();
        return result;
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    }
  };
  return model;
}
module.exports = createCrudModel;
