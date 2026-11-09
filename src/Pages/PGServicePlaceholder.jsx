import React from "react";
import PaymentGatewayService from "./PaymentGatewayService";

const PGServicePlaceholder = ({ serviceName = "PG 1", currentUser }) => {
  return <PaymentGatewayService serviceName={serviceName} currentUser={currentUser} />;
};

export default PGServicePlaceholder;
