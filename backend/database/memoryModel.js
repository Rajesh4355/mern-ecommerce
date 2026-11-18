const mongoose = require('mongoose');
const crypto = require('crypto');

const memoryStores = new Map();
const modelRegistry = new Map();

function isMongoReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function generateObjectId() {
  return crypto.randomBytes(12).toString('hex');
}

function getStore(name) {
  if (!memoryStores.has(name)) {
    memoryStores.set(name, []);
  }
  return memoryStores.get(name);
}

function clonePlain(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return new Date(val.getTime());
  if (Array.isArray(val)) return val.map(clonePlain);
  if (typeof val === 'object') {
    const out = {};
    for (const key of Object.keys(val)) {
      if (key.startsWith('$') || typeof val[key] === 'function') continue;
      out[key] = clonePlain(val[key]);
    }
    return out;
  }
  return val;
}

function getSchemaDefaults(schema) {
  const defaults = {};
  if (!schema || !schema.paths) return defaults;
  for (const [pathName, schemaType] of Object.entries(schema.paths)) {
    if (pathName === '_id' || pathName === '__v') continue;
    if (schemaType && schemaType.defaultValue !== undefined) {
      defaults[pathName] = schemaType.defaultValue;
    }
  }
  return defaults;
}

function getRefMap(schema) {
  const refs = {};
  if (!schema || !schema.paths) return refs;
  for (const [pathName, schemaType] of Object.entries(schema.paths)) {
    if (schemaType && schemaType.options && schemaType.options.ref) {
      refs[pathName] = schemaType.options.ref;
    }
  }
  return refs;
}

function getDatePaths(schema) {
  const datePaths = new Set();
  if (!schema || !schema.paths) return datePaths;
  for (const [pathName, schemaType] of Object.entries(schema.paths)) {
    if (schemaType && schemaType.instance === 'Date') {
      datePaths.add(pathName);
    }
  }
  return datePaths;
}

function normalizeDocData(raw, schema) {
  const defaults = getSchemaDefaults(schema);
  const datePaths = getDatePaths(schema);
  const data = clonePlain(raw) || {};

  if (!data._id) {
    data._id = generateObjectId();
  } else {
    data._id = String(data._id);
  }

  for (const [key, defVal] of Object.entries(defaults)) {
    if (data[key] === undefined) {
      data[key] = typeof defVal === 'function' ? defVal() : clonePlain(defVal);
    }
  }

  for (const key of datePaths) {
    if (data[key] !== undefined && data[key] !== null && !(data[key] instanceof Date)) {
      const parsed = new Date(data[key]);
      if (!Number.isNaN(parsed.getTime())) {
        data[key] = parsed;
      }
    }
  }

  if (schema && schema.options && schema.options.timestamps) {
    const now = new Date();
    if (!data.createdAt) data.createdAt = now;
    if (!data.updatedAt) data.updatedAt = now;
  }

  return data;
}

function matchesFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, condition] of Object.entries(filter)) {
    const val = doc[key];
    if (condition && typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof Date)) {
      if ('$in' in condition) {
        const list = Array.isArray(condition.$in) ? condition.$in : [condition.$in];
        const strList = list.map((x) => String(x));
        if (Array.isArray(val)) {
          if (!val.some((v) => strList.includes(String(v && v._id ? v._id : v)))) return false;
        } else {
          const cmp = val && typeof val === 'object' && val._id ? String(val._id) : String(val);
          if (!strList.includes(cmp)) return false;
        }
        continue;
      }
    }
    const docCmp = val && typeof val === 'object' && val._id ? String(val._id) : val;
    if (docCmp === undefined && condition === undefined) continue;
    if (String(docCmp) !== String(condition)) return false;
  }
  return true;
}

function applySelect(obj, select) {
  if (!obj || !select) return obj;
  const parts = String(select).trim().split(/\s+/);
  const excludes = parts.filter((p) => p.startsWith('-')).map((p) => p.slice(1));
  if (excludes.length > 0) {
    const copy = { ...obj };
    for (const field of excludes) {
      delete copy[field];
    }
    return copy;
  }
  return obj;
}

function populateDoc(doc, populateSpecs, schema) {
  if (!doc || !populateSpecs || populateSpecs.length === 0) return doc;
  const refs = getRefMap(schema);

  for (const spec of populateSpecs) {
    if (!spec) continue;
    if (Array.isArray(spec)) {
      populateDoc(doc, spec, schema);
      continue;
    }
    const pathName = typeof spec === 'string' ? spec : spec.path;
    const nestedPopulate = typeof spec === 'object' ? spec.populate : null;
    const select = typeof spec === 'object' ? spec.select : null;
    if (!pathName) continue;

    const refModelName = refs[pathName];
    if (!refModelName || !modelRegistry.has(refModelName)) continue;

    const refMeta = modelRegistry.get(refModelName);
    const refStore = getStore(refModelName);
    const rawVal = doc[pathName];
    if (!rawVal) continue;

    const rawId = typeof rawVal === 'object' && rawVal._id ? String(rawVal._id) : String(rawVal);
    const found = refStore.find((item) => String(item._id) === rawId);
    if (found) {
      let populated = clonePlain(found);
      if (nestedPopulate) {
        const nestedSpecs = Array.isArray(nestedPopulate) ? nestedPopulate : [nestedPopulate];
        populated = populateDoc(populated, nestedSpecs, refMeta.schema);
      }
      if (select) {
        populated = applySelect(populated, select);
      }
      doc[pathName] = populated;
    }
  }
  return doc;
}

function wrapDocument(data, modelName, schema) {
  const doc = { ...data };
  const refs = getRefMap(schema);

  Object.defineProperty(doc, 'toObject', {
    enumerable: false,
    configurable: true,
    value: function toObject() {
      return clonePlain(this);
    },
  });

  Object.defineProperty(doc, 'populate', {
    enumerable: false,
    configurable: true,
    value: async function populate(spec) {
      const specs = Array.isArray(spec) ? spec : [spec];
      populateDoc(this, specs, schema);
      return this;
    },
  });

  Object.defineProperty(doc, 'save', {
    enumerable: false,
    configurable: true,
    value: async function save() {
      const store = getStore(modelName);
      const plain = clonePlain(this);
      // Collapse populated ref objects back to IDs for canonical storage
      for (const pathName of Object.keys(refs)) {
        if (plain[pathName] && typeof plain[pathName] === 'object' && plain[pathName]._id) {
          plain[pathName] = String(plain[pathName]._id);
        }
      }
      const normalized = normalizeDocData(plain, schema);
      const idx = store.findIndex((item) => String(item._id) === String(normalized._id));
      if (idx >= 0) {
        store[idx] = normalized;
      } else {
        store.push(normalized);
      }
      this._id = normalized._id;
      return this;
    },
  });

  return doc;
}

class MemoryQuery {
  constructor(executor, schema, modelName, isArray) {
    this._executor = executor;
    this._schema = schema;
    this._modelName = modelName;
    this._isArray = isArray;
    this._populates = [];
    this._sort = null;
    this._skip = 0;
    this._limit = 0;
    this._countOnly = false;
  }

  populate(spec) {
    if (Array.isArray(spec)) {
      this._populates.push(...spec);
    } else if (spec) {
      this._populates.push(spec);
    }
    return this;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  skip(n) {
    this._skip = Number(n) || 0;
    return this;
  }

  limit(n) {
    this._limit = Number(n) || 0;
    return this;
  }

  countDocuments() {
    this._countOnly = true;
    return this;
  }

  async exec() {
    let result = await this._executor();
    if (this._countOnly) {
      return Array.isArray(result) ? result.length : result ? 1 : 0;
    }

    if (this._isArray) {
      let list = result.map((d) => clonePlain(d));

      if (this._sort && Object.keys(this._sort).length > 0) {
        const sortEntries = Object.entries(this._sort);
        list.sort((a, b) => {
          for (const [field, dir] of sortEntries) {
            const av = a[field];
            const bv = b[field];
            if (av === bv) continue;
            if (av === undefined || av === null) return 1;
            if (bv === undefined || bv === null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') {
              return (av - bv) * (dir >= 0 ? 1 : -1);
            }
            return String(av).localeCompare(String(bv)) * (dir >= 0 ? 1 : -1);
          }
          return 0;
        });
      }

      if (this._skip > 0) {
        list = list.slice(this._skip);
      }
      if (this._limit > 0) {
        list = list.slice(0, this._limit);
      }

      return list.map((item) => {
        const populated = populateDoc(item, this._populates, this._schema);
        return wrapDocument(populated, this._modelName, this._schema);
      });
    }

    if (!result) return null;
    const populated = populateDoc(clonePlain(result), this._populates, this._schema);
    return wrapDocument(populated, this._modelName, this._schema);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

function createModel(name, schema) {
  const RealModel = mongoose.models[name] || mongoose.model(name, schema);
  modelRegistry.set(name, { schema, RealModel });
  getStore(name);

  function ModelFacade(docData) {
    if (isMongoReady()) {
      return new RealModel(docData);
    }
    const normalized = normalizeDocData(docData, schema);
    return wrapDocument(normalized, name, schema);
  }

  ModelFacade.modelName = name;
  ModelFacade.schema = schema;

  ModelFacade.insertMany = async (docs) => {
    if (isMongoReady()) {
      return RealModel.insertMany(docs);
    }
    const store = getStore(name);
    const inserted = [];
    for (const raw of docs) {
      const normalized = normalizeDocData(raw, schema);
      const existsIdx = store.findIndex((item) => String(item._id) === String(normalized._id));
      if (existsIdx === -1) {
        store.push(normalized);
      }
      inserted.push(wrapDocument(clonePlain(normalized), name, schema));
    }
    return inserted;
  };

  ModelFacade.find = (filter = {}) => {
    if (isMongoReady()) {
      return RealModel.find(filter);
    }
    return new MemoryQuery(
      async () => getStore(name).filter((doc) => matchesFilter(doc, filter)),
      schema,
      name,
      true
    );
  };

  ModelFacade.findOne = (filter = {}) => {
    if (isMongoReady()) {
      return RealModel.findOne(filter);
    }
    return new MemoryQuery(
      async () => getStore(name).find((doc) => matchesFilter(doc, filter)) || null,
      schema,
      name,
      false
    );
  };

  ModelFacade.findById = (id) => {
    if (isMongoReady()) {
      return RealModel.findById(id);
    }
    return new MemoryQuery(
      async () => getStore(name).find((doc) => String(doc._id) === String(id)) || null,
      schema,
      name,
      false
    );
  };

  ModelFacade.findByIdAndUpdate = (id, update, options = {}) => {
    if (isMongoReady()) {
      return RealModel.findByIdAndUpdate(id, update, options);
    }
    return new MemoryQuery(
      async () => {
        const store = getStore(name);
        const idx = store.findIndex((doc) => String(doc._id) === String(id));
        if (idx === -1) return null;
        const prev = clonePlain(store[idx]);
        const patch = clonePlain(update);
        delete patch._id;
        const updated = { ...prev, ...patch };
        if (schema && schema.options && schema.options.timestamps) {
          updated.updatedAt = new Date();
        }
        store[idx] = updated;
        return options.new ? updated : prev;
      },
      schema,
      name,
      false
    );
  };

  ModelFacade.findByIdAndDelete = (id) => {
    if (isMongoReady()) {
      return RealModel.findByIdAndDelete(id);
    }
    return new MemoryQuery(
      async () => {
        const store = getStore(name);
        const idx = store.findIndex((doc) => String(doc._id) === String(id));
        if (idx === -1) return null;
        const [removed] = store.splice(idx, 1);
        return removed;
      },
      schema,
      name,
      false
    );
  };

  ModelFacade.deleteMany = async (filter = {}) => {
    if (isMongoReady()) {
      return RealModel.deleteMany(filter);
    }
    const store = getStore(name);
    const remaining = store.filter((doc) => !matchesFilter(doc, filter));
    const deletedCount = store.length - remaining.length;
    memoryStores.set(name, remaining);
    return { acknowledged: true, deletedCount };
  };

  return ModelFacade;
}

function clearMemoryStores() {
  for (const key of memoryStores.keys()) {
    memoryStores.set(key, []);
  }
}

module.exports = {
  createModel,
  isMongoReady,
  clearMemoryStores,
};
