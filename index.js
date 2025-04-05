// Importar los módulos necesarios
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const multer = require("multer"); // <--- Importar multer

// Crear la aplicación Express
const app = express();
const port = 8000;

// --- Configurar Multer ---
// Como no estamos guardando archivos, solo necesitamos que parsee los campos.
// multer() sin opciones usará almacenamiento en memoria (que no usaremos aquí)
// .none() es específico para cuando solo esperas campos de texto multipart.
const upload = multer();

// --- Middleware Global ---
// Middleware para parsear JSON (para otras rutas o si envías JSON)
app.use(express.json());
// Middleware para parsear datos de formularios URL-encoded (si usas ese tipo)
app.use(express.urlencoded({ extended: true }));

// --- Conexión a la Base de Datos ---
// (El código de conexión a la BD permanece igual)
const dbPath = path.resolve(__dirname, "students.sqlite");
const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error("Error connecting to the database:", err.message);
    } else {
      console.log("Connected to the SQLite database.");
      db.run(
        `CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstname TEXT NOT NULL,
          lastname TEXT NOT NULL,
          gender TEXT,
          age INTEGER
        )`,
        (err) => {
          if (err) {
            console.error("Error creating table:", err.message);
          } else {
            console.log("Table 'students' is ready.");
          }
        },
      );
    }
  },
);

// --- Rutas de la API ---

// Ruta para obtener todos los estudiantes (GET) y crear uno nuevo (POST)
app.route("/students")
  .get((req, res) => {
    const sql = "SELECT * FROM students";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Error fetching students:", err.message);
        return res
          .status(500)
          .json({ error: "Error fetching students from database" });
      }
      res.json(rows);
    });
  })
  // --- Aplicar middleware multer AQUÍ para el POST ---
  // upload.none() parseará los campos multipart/form-data y los pondrá en req.body
  .post(upload.none(), (req, res) => {
    // Ahora req.body debería contener los datos del form-data
    console.log("Received body:", req.body); // <-- Añade esto para depurar
    const { firstname, lastname, gender, age } = req.body;

    if (!firstname || !lastname) {
      return res
        .status(400)
        .json({ error: "Firstname and Lastname are required" });
    }

    const sql = `INSERT INTO students (firstname, lastname, gender, age)
                 VALUES (?, ?, ?, ?)`;
    const ageParam =
      age !== undefined && age !== null && age !== ""
        ? parseInt(age, 10)
        : null;
    // Validar si ageParam es un número válido después del parseInt
    if (ageParam !== null && isNaN(ageParam)) {
         return res.status(400).json({ error: "Age must be a valid number" });
    }
    const params = [firstname, lastname, gender, ageParam];

    db.run(sql, params, function (err) {
      if (err) {
        console.error("Error inserting student:", err.message);
        return res
          .status(500)
          .json({ error: "Error inserting student into database" });
      }
      res.status(201).json({
        message: "Student created successfully",
        id: this.lastID,
      });
    });
  });

// Ruta para operaciones sobre un estudiante específico (GET, PUT, DELETE)
app.route("/student/:id")
  .get((req, res) => {
    // (GET no necesita multer)
    const id = req.params.id;
    const sql = "SELECT * FROM students WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Error fetching student:", err.message);
        return res
          .status(500)
          .json({ error: "Error fetching student from database" });
      }
      if (row) {
        res.json(row);
      } else {
        res.status(404).json({ error: `Student with id ${id} not found` });
      }
    });
  })
  // --- Aplicar middleware multer AQUÍ también para el PUT ---
  .put(upload.none(), (req, res) => {
    // req.body contendrá los datos del form-data
    console.log("Received body for PUT:", req.body); // <-- Añade esto para depurar
    const id = req.params.id;
    const { firstname, lastname, gender, age } = req.body;

    if (!firstname || !lastname) {
      return res
        .status(400)
        .json({ error: "Firstname and Lastname are required for update" });
    }

    const sql = `UPDATE students SET firstname = ?, lastname = ?, gender = ?, age = ?
                 WHERE id = ?`;
    const ageParam =
      age !== undefined && age !== null && age !== ""
        ? parseInt(age, 10)
        : null;
    // Validar si ageParam es un número válido después del parseInt
    if (ageParam !== null && isNaN(ageParam)) {
         return res.status(400).json({ error: "Age must be a valid number" });
    }
    const params = [firstname, lastname, gender, ageParam, id];

    db.run(sql, params, function (err) {
      if (err) {
        console.error("Error updating student:", err.message);
        return res
          .status(500)
          .json({ error: "Error updating student in database" });
      }
      if (this.changes > 0) {
        res.json({
          id: parseInt(id, 10),
          firstname: firstname,
          lastname: lastname,
          gender: gender,
          age: ageParam,
        });
      } else {
        res.status(404).json({ error: `Student with id ${id} not found` });
      }
    });
  })
  .delete((req, res) => {
    // (DELETE no necesita multer, no tiene cuerpo generalmente)
    const id = req.params.id;
    const sql = "DELETE FROM students WHERE id = ?";
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Error deleting student:", err.message);
        return res
          .status(500)
          .json({ error: "Error deleting student from database" });
      }
      if (this.changes > 0) {
        res.json({
          message: `The Student with id: ${id} has been deleted.`,
        });
      } else {
        res.status(404).json({ error: `Student with id ${id} not found` });
      }
    });
  });

// --- Iniciar el servidor ---
// (El código para iniciar el servidor y cerrar la BD permanece igual)
app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`Try sending POST/PUT requests with form-data or JSON body.`);
});

process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      return console.error("Error closing database:", err.message);
    }
    console.log("Database connection closed.");
    process.exit(0);
  });
});
