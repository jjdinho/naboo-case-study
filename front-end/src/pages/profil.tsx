import { EmptyData, FavoriteList, PageTitle } from "@/components";
import { withAuth } from "@/hocs";
import { useAuth, useFavoriteActivities } from "@/hooks";
import { Avatar, Flex, Text } from "@mantine/core";
import Head from "next/head";

const Profile = () => {
  const { user } = useAuth();
  const { favorites, loading, remove } = useFavoriteActivities();

  return (
    <>
      <Head>
        <title>Mon profil | CDTR</title>
      </Head>
      <PageTitle title="Mon profil" />
      <Flex align="center" gap="md">
        <Avatar color="cyan" radius="xl" size="lg">
          {user?.firstName[0]}
          {user?.lastName[0]}
        </Avatar>
        <Flex direction="column">
          <Text>{user?.email}</Text>
          <Text>{user?.firstName}</Text>
          <Text>{user?.lastName}</Text>
        </Flex>
      </Flex>
      <PageTitle title="Mes favoris" />
      {favorites.length > 0 ? (
        <FavoriteList favorites={favorites} onRemove={remove} />
      ) : (
        !loading && <EmptyData />
      )}
    </>
  );
};

export default withAuth(Profile);
