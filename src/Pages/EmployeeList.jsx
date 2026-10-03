import UserList from "./UserList";

function EmployeeList({ currentUser }) {
  return (
    <UserList
      currentUser={currentUser}
      title="Employee List"
      lockedRole="employee"
      listMode="employees"
    />
  );
}

export default EmployeeList;
