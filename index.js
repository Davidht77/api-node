// Importar los módulos necesarios
const express = require("express");
const sqlite3 = require("sqlite3").verbose(); // .verbose() para mensajes de error más detallados
const path = require("path");

// Crear la aplicación Express
const app = express();
const port = 8000;

// Middleware para parsear datos de formularios URL-encoded
app.use(express.urlencoded({ extended: true }));
// Middleware para parsear JSON (útil si decides enviar JSON desde el cliente)
app.use(express.json());

// --- Conexión a la Base de Datos ---
const dbPath = path.resolve(__dirname, "students.sqlite");
const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, // Abrir para leer/escribir, crear si no existe
  (err) => {
    if (err) {
      console.error("Error connecting to the database:", err.message);
    } else {
      console.log("Connected to the SQLite database.");
      // Crear la tabla si no existe (importante hacerlo después de conectar)
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
      // El paquete sqlite3 ya devuelve un array de objetos, similar al dict comprehension de Python
      res.json(rows);
    });
  })
  .post((req, res) => {
    // Extraer datos del cuerpo de la solicitud (form data)
    const { firstname, lastname, gender, age } = req.body;

    // Validar datos básicos (puedes añadir validación más robusta)
    if (!firstname || !lastname) {
      return res
        .status(400)
        .json({ error: "Firstname and Lastname are required" });
    }

    const sql = `INSERT INTO students (firstname, lastname, gender, age)
                 VALUES (?, ?, ?, ?)`;
    const params = [firstname, lastname, gender, age];

    // Usar 'function' para poder acceder a 'this.lastID'
    db.run(sql, params, function (err) {
      if (err) {
        console.error("Error inserting student:", err.message);
        return res
          .status(500)
          .json({ error: "Error inserting student into database" });
      }
      // Enviar respuesta de éxito con el ID del nuevo estudiante
      res
        .status(201) // 201 Created es más apropiado para POST exitoso
        .json({
          message: "Student created successfully",
          id: this.lastID, // 'this.lastID' contiene el ID de la fila insertada
        });
    });
  });

// Ruta para operaciones sobre un estudiante específico (GET, PUT, DELETE)
app.route("/student/:id")
  .get((req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM students WHERE id = ?";

    db.get(sql, [id], (err, row) => {
      // db.get devuelve una sola fila o undefined
      if (err) {
        console.error("Error fetching student:", err.message);
        return res
          .status(500)
          .json({ error: "Error fetching student from database" });
      }
      if (row) {
        res.json(row); // Enviar el estudiante encontrado
      } else {
        res.status(404).json({ error: `Student with id ${id} not found` }); // 404 Not Found
      }
    });
  })
  .put((req, res) => {
    const id = req.params.id;
    const { firstname, lastname, gender, age } = req.body;

    if (!firstname || !lastname) {
      return res
        .status(400)
        .json({ error: "Firstname and Lastname are required for update" });
    }

    const sql = `UPDATE students SET firstname = ?, lastname = ?, gender = ?, age = ?
                 WHERE id = ?`;
    const params = [firstname, lastname, gender, age, id];

    // Usar 'function' para poder acceder a 'this.changes'
    db.run(sql, params, function (err) {
      if (err) {
        console.error("Error updating student:", err.message);
        return res
          .status(500)
          .json({ error: "Error updating student in database" });
      }
      if (this.changes > 0) {
        // 'this.changes' indica cuántas filas fueron afectadas
        // Devolver el objeto actualizado (como en el código Python)
        res.json({
          id: parseInt(id, 10), // Asegurarse que el id sea número
          firstname: firstname,
          lastname: lastname,
          gender: gender,
          age: age ? parseInt(age, 10) : null, // Convertir edad a número si existe
        });
      } else {
        res.status(404).json({ error: `Student with id ${id} not found` }); // 404 si no se actualizó nada
      }
    });
  })
  .delete((req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM students WHERE id = ?";

    // Usar 'function' para poder acceder a 'this.changes'
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
        res.status(404).json({ error: `Student with id ${id} not found` }); // 404 si no se borró nada
      }
    });
  });

// --- Iniciar el servidor ---
app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// --- Cerrar la conexión a la base de datos al salir ---
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      return console.error("Error closing database:", err.message);
    }
    console.log("Database connection closed.");
    process.exit(0);
  });
});
