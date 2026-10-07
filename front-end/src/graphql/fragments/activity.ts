import gql from "graphql-tag";

const ActivityFragment = gql`
  fragment Activity on Activity {
    id
    city
    description
    name
    price
    createdAt
  }
`;

export default ActivityFragment;
