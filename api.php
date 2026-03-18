<?php
error_reporting(0); 
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Content-Type: application/json; charset=UTF-8");

$host = "localhost:3306";
$user = "root";
$pass = ""; 
$dbname = "company";

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli($host, $user, $pass, $dbname);
    $conn->set_charset("utf8mb4");

    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents("php://input"), true);

    switch ($method) {
        case 'GET':
            // Зареждане на мета данни (за падащите менюта)
            if (isset($_GET['action']) && $_GET['action'] == 'meta') {
                $depts = $conn->query("SELECT department_id as id, name FROM departments ORDER BY name")->fetch_all(MYSQLI_ASSOC);
                $addresses = $conn->query("SELECT a.address_id as id, CONCAT(a.address_text, ' (', IFNULL(t.name, 'Без град'), ')') as name FROM addresses a LEFT JOIN towns t ON a.town_id = t.town_id ORDER BY t.name")->fetch_all(MYSQLI_ASSOC);
                $towns = $conn->query("SELECT town_id as id, name FROM towns ORDER BY name")->fetch_all(MYSQLI_ASSOC);
                
                echo json_encode(['departments' => $depts, 'addresses' => $addresses, 'towns' => $towns]);
                exit;
            }

            // Зареждане на данни за таблицата и Ексел
            if (isset($_GET['action']) && $_GET['action'] == 'data') {
                $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
                $limit = (isset($_GET['limit']) && $_GET['limit'] === 'all') ? 'all' : (isset($_GET['limit']) ? (int)$_GET['limit'] : 10);
                
                $search = $conn->real_escape_string($_GET['search'] ?? '');
                $dept = $conn->real_escape_string($_GET['dept'] ?? '');
                $town = $conn->real_escape_string($_GET['town'] ?? '');
                $minSal = $_GET['minSal'] ?? '';
                $maxSal = $_GET['maxSal'] ?? '';
                $sort = $conn->real_escape_string($_GET['sort'] ?? '');
                $dir = strtoupper($_GET['dir'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

                $where = ["1=1"];
                if ($search) $where[] = "(e.first_name LIKE '%$search%' OR e.last_name LIKE '%$search%' OR CONCAT(e.first_name, ' ', e.last_name) LIKE '%$search%')";
                if ($dept) $where[] = "d.name = '$dept'";
                if ($town) $where[] = "t.name = '$town'";
                if ($minSal !== '') $where[] = "e.salary >= " . (float)$minSal;
                if ($maxSal !== '') $where[] = "e.salary <= " . (float)$maxSal;
                
                $whereClause = implode(" AND ", $where);

                // Сортиране
                $allowedSorts = [
                    'full_name' => "CONCAT(e.first_name, ' ', e.last_name)", 
                    'job_title' => 'e.job_title', 
                    'salary' => 'e.salary', 
                    'address_text' => 'a.address_text'
                ];
                $orderBy = "e.employee_id DESC"; // По подразбиране
                if ($sort && array_key_exists($sort, $allowedSorts)) {
                    $orderBy = $allowedSorts[$sort] . " $dir";
                }

                $query = "SELECT e.employee_id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as full_name, 
                          e.job_title, e.salary, d.name as department_name, a.address_text, t.name as town,
                          e.department_id, e.address_id
                          FROM employees e 
                          LEFT JOIN departments d ON e.department_id = d.department_id 
                          LEFT JOIN addresses a ON e.address_id = a.address_id 
                          LEFT JOIN towns t ON a.town_id = t.town_id 
                          WHERE $whereClause 
                          ORDER BY $orderBy";

                if ($limit === 'all') {
                    $data = $conn->query($query)->fetch_all(MYSQLI_ASSOC);
                    echo json_encode(['data' => $data]);
                } else {
                    $offset = ($page - 1) * $limit;
                    $countQuery = "SELECT COUNT(*) as total FROM employees e 
                                   LEFT JOIN departments d ON e.department_id = d.department_id 
                                   LEFT JOIN addresses a ON e.address_id = a.address_id 
                                   LEFT JOIN towns t ON a.town_id = t.town_id 
                                   WHERE $whereClause";
                    $totalRes = $conn->query($countQuery)->fetch_assoc();
                    $total = (int)$totalRes['total'];
                    
                    $query .= " LIMIT $limit OFFSET $offset";
                    $data = $conn->query($query)->fetch_all(MYSQLI_ASSOC);
                    
                    echo json_encode(['data' => $data, 'total' => $total]);
                }
                exit;
            }
            break;

        case 'POST':
            $stmt = $conn->prepare("INSERT INTO employees (first_name, last_name, job_title, department_id, salary, address_id, hire_date) VALUES (?, ?, ?, ?, ?, ?, NOW())");
            $stmt->bind_param("sssidi", $input['first_name'], $input['last_name'], $input['job_title'], $input['department_id'], $input['salary'], $input['address_id']);
            if($stmt->execute()) echo json_encode(["success" => true]); else echo json_encode(["error" => "Грешка при добавяне"]);
            break;

        case 'PUT':
            $stmt = $conn->prepare("UPDATE employees SET first_name=?, last_name=?, job_title=?, department_id=?, salary=?, address_id=? WHERE employee_id=?");
            $stmt->bind_param("sssidii", $input['first_name'], $input['last_name'], $input['job_title'], $input['department_id'], $input['salary'], $input['address_id'], $input['employee_id']);
            if($stmt->execute()) echo json_encode(["success" => true]); else echo json_encode(["error" => "Грешка при редакция"]);
            break;

        case 'DELETE':
            $id = (int)$_GET['id'];
            try { $conn->query("DELETE FROM employees_projects WHERE employee_id = $id"); } catch(Exception $e) {}
            if($conn->query("DELETE FROM employees WHERE employee_id = $id")) echo json_encode(["success" => true]);
            else echo json_encode(["error" => "Грешка при изтриване"]);
            break;
    }
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}
?>